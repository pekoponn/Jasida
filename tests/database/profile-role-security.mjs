import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const admin = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const citizen = '00000000-0000-4000-8000-000000000003';
await db.exec(`
  create role authenticated; create role anon; create role service_role bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid',true),'')::uuid
  $$;
  grant usage on schema auth,public to authenticated,anon,service_role;
  create table public.profiles(id uuid primary key,role text,username text,full_name text,
    avatar_url text,created_at timestamptz default now());
  insert into public.profiles(id,role,username) values
    ('${admin}','admin','Admin'),('${other}','admin','Other'),('${citizen}','user','User');
  alter table public.profiles enable row level security;
  create policy read_profiles on public.profiles for select using(true);
  -- Simulate an overly broad existing policy and legacy column grants.
  create policy update_profiles on public.profiles for update using(true) with check(true);
  grant select,insert,update,delete on public.profiles to authenticated,anon;
  grant update(role),insert(role) on public.profiles to authenticated,anon;
`);
const sql = readFileSync(
  new URL('../../supabase/migrations/20261027_profile_role_security.sql', import.meta.url),
  'utf8'
);
await db.exec(sql);
await db.exec(sql);
const deny = async (query, pattern) => assert.rejects(db.exec(query), pattern);
const rpc = (id, role) => `select public.jasida_set_user_role('${id}','${role}')`;
await db.exec('set role anon');
await deny(rpc(citizen, 'admin'), /permission denied/);
await deny(`update public.profiles set username='x' where id='${citizen}'`, /permission denied/);
console.log('PASS role: anonymous RPC/profile writes denied');
await db.exec(`reset role; set role authenticated; set test.uid='';`);
await deny(rpc(citizen, 'admin'), /Authentication required/);
await db.exec(`set test.uid='${citizen}'`);
await deny(rpc(citizen, 'admin'), /Only authenticated admins/);
await deny(rpc(other, 'user'), /Only authenticated admins/);
await deny(`update public.profiles set role='admin' where id='${citizen}'`, /permission denied/);
await deny(
  `insert into public.profiles(id,role) values(gen_random_uuid(),'admin')`,
  /permission denied/
);
await deny(`delete from public.profiles where id='${admin}'`, /permission denied/);
await db.exec(
  `update public.profiles set username='Edited',full_name='Name',avatar_url='/avatar' where id='${citizen}'`
);
assert.equal(
  (await db.query(`select username from public.profiles where id='${citizen}'`)).rows[0].username,
  'Edited'
);
assert.equal(
  (
    await db.query(
      `update public.profiles set username='Hijacked' where id='${other}' returning id`
    )
  ).rows.length,
  0
);
console.log(
  'PASS role: citizen escalation denied, own profile/avatar edits preserved, cross-user edits blocked'
);
await db.exec(`set test.uid='${admin}'`);
await deny(`update public.profiles set role='admin' where id='${citizen}'`, /permission denied/);
await deny(rpc(citizen, 'superadmin'), /Invalid target or role/);
await deny(`select public.jasida_set_user_role(null,'user')`, /Invalid target or role/);
await deny(rpc('not-a-uuid', 'user'), /invalid input syntax/);
await deny(rpc('00000000-0000-4000-8000-999999999999', 'user'), /Profile not found/);
await deny(rpc(admin, 'user'), /own role/);
await deny(rpc(admin, 'admin'), /own role/);
const changed = (await db.query(rpc(citizen, 'admin'))).rows[0].jasida_set_user_role;
assert.deepEqual(changed, { id: citizen, role: 'admin' });
await db.exec(rpc(citizen, 'admin')); // no-op must not add an audit entry
await db.exec(rpc(citizen, 'user'));
await db.exec(rpc(other, 'user'));
await deny(rpc(admin, 'user'), /last admin/);
await deny('select * from public.profile_role_audit', /permission denied/);
await db.exec(`set test.uid='${other}'`);
await deny(rpc(citizen, 'admin'), /Only authenticated admins/);
console.log(
  'PASS role: admin RPC, invalid targets/roles, self changes, last admin and demoted caller checks'
);
await db.exec('reset role');
const audit = (
  await db.query(
    'select actor_id,target_id,old_role,new_role,changed_at from public.profile_role_audit order by id'
  )
).rows;
assert.equal(audit.length, 3);
assert.ok(audit.every((r) => r.actor_id === admin && r.changed_at));
assert.deepEqual(
  audit.map((r) => r.new_role),
  ['admin', 'user', 'user']
);
for (const role of ['anon', 'authenticated', 'service_role']) {
  const result = (
    await db.query(`select has_function_privilege('${role}','public.jasida_set_user_role(uuid,text)','EXECUTE') as execute,
 has_column_privilege('${role}','public.profiles','role','UPDATE') as role_update`)
  ).rows[0];
  assert.equal(result.execute, role === 'authenticated');
  assert.equal(result.role_update, false);
}
const fn = (
  await db.query(
    "select prosecdef,proconfig,prosrc from pg_proc where proname='jasida_set_user_role'"
  )
).rows[0];
assert.equal(fn.prosecdef, true);
assert.ok(fn.proconfig.includes('search_path=""'));
assert.match(fn.prosrc, /lock table public\.profiles in share row exclusive mode/);
console.log(
  'PASS role: atomic audit, repeatable migration, EXECUTE/search_path/column grants; serialized mutation design inspected (no multi-session concurrency claim)'
);
await db.exec(`create schema storage;
 create table storage.buckets(id text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
const auditSql = readFileSync(
  new URL('../../supabase/audit-production-security.sql', import.meta.url),
  'utf8'
);
await db.exec('begin read only');
await db.exec(auditSql);
await db.exec('rollback');
console.log(
  'PASS audit: all metadata queries execute inside a READ ONLY transaction on synthetic schema'
);
await db.close();
