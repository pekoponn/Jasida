import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const user = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
await db.exec(`create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated;
create table public.reports(id int generated always as identity primary key,user_id uuid,status text default 'open',image_path text,
  started_at timestamptz,accepted_at timestamptz);
insert into public.reports(user_id,status,started_at,accepted_at) values('${user}','in_progress','2026-01-01','2026-01-02');
alter table public.reports enable row level security;
create policy legacy_insert on public.reports for insert with check(true);
create policy legacy_read on public.reports for select using(true);
create policy legacy_update on public.reports for update using(true);
grant select,insert,update on public.reports to anon,authenticated;
grant usage on sequence public.reports_id_seq to anon,authenticated;`);
const sql = readFileSync(
  new URL('../../supabase/migrations/20261027200000_reports_insert_boundary.sql', import.meta.url),
  'utf8'
);
await db.exec(sql);
await db.exec(sql);
const deny = async (q) => assert.rejects(db.exec(q), /row-level security/);
await db.exec("set role anon; set test.uid='';");
await deny(`insert into public.reports(user_id) values('${user}')`);
await db.exec("reset role; set role authenticated; set test.uid='';");
await deny(`insert into public.reports(user_id) values('${user}')`);
await db.exec(`set test.uid='${user}'`);
await deny(`insert into public.reports(user_id) values('${other}')`);
await deny('insert into public.reports default values');
for (const status of ['accepted', 'in_progress', 'resolved', 'rejected']) {
  await deny(`insert into public.reports(user_id,status) values('${user}','${status}')`);
}
await deny(`insert into public.reports(user_id,status) values('${user}',null)`);
await db.exec(`insert into public.reports(user_id) values('${user}');
insert into public.reports(user_id,status) values('${user}','pending_duplicate_review');`);
assert.equal((await db.query('select count(*)::int as n from public.reports')).rows[0].n, 3);
// This deliberately verifies limited scope: public SELECT and ordinary image linking
// were not replaced; it does not claim these legacy policies are production-safe.
await db.exec("update public.reports set image_path='fixture.webp' where id=1");
const historic = (await db.query('select * from public.reports where id=1')).rows[0];
assert.equal(historic.status, 'in_progress');
assert.ok(new Date(historic.started_at) < new Date(historic.accepted_at));
assert.equal(historic.image_path, 'fixture.webp');
await db.exec('reset role');
// An owner bypasses RLS; production SECURITY DEFINER creation RPCs still need audit.
await db.exec(`insert into public.reports(user_id,status) values('${other}','resolved')`);
assert.equal((await db.query('select count(*)::int as n from public.reports')).rows[0].n, 4);
// No permissive policy means no access: migration must not add an allow-all grant.
await db.exec('drop policy legacy_insert on public.reports; set role authenticated');
await deny(`insert into public.reports(user_id) values('${user}')`);
await db.exec('reset role');
const policies = (
  await db.query(
    "select permissive,cmd from pg_policies where policyname='jasida_reports_insert_boundary'"
  )
).rows;
assert.deepEqual(policies, [{ permissive: 'RESTRICTIVE', cmd: 'INSERT' }]);
console.log(
  'PASS report INSERT: anon/empty identity/forged owner/invalid status denied; own intake succeeds; restrictive intersection; idempotent; historical anomaly unchanged; owner bypass documented'
);
await db.close();
