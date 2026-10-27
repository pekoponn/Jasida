import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { isEvaluationPair } from '../../src/lib/materialPricing.js';
const db = new PGlite();
const admin = '00000000-0000-4000-8000-000000000001';
const user = '00000000-0000-4000-8000-000000000002';
// Synthetic schema/RLS, not a copy of production. Broad own-row UPDATE deliberately
// exercises trigger defense even if a permissive reports policy exists.
await db.exec(`
  create role authenticated; create role anon; create role service_role bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true),'')::uuid
  $$;
  create table public.profiles(id uuid primary key, role text);
  insert into public.profiles values ('${admin}','admin'),('${user}','user');
  create table public.reports(
    id integer primary key, user_id uuid default auth.uid(), status text default 'open',
    estimated_cost numeric,actual_cost numeric,estimated_materials_json jsonb,
    estimated_materials text,actual_materials text,actual_materials_json jsonb,
    resolved_at timestamptz, accepted_at timestamptz, started_at timestamptz, rejected_at timestamptz, note text
  );
  insert into public.reports(id,status,estimated_cost,actual_cost,resolved_at)
    values (2,'resolved',100,120,now()),(3,'resolved',100,120,null);
  grant usage on schema public,auth to authenticated,anon,service_role;
  grant execute on function auth.uid() to authenticated,anon,service_role;
  grant select,insert,update on public.reports to authenticated;
`);
const migration = readFileSync(
  new URL('../../supabase/migrations/20261026_material_pricing.sql', import.meta.url),
  'utf8'
);
await db.exec(migration);
await db.exec(migration);
await db.exec(`
  alter table public.reports enable row level security;
  create policy read_reports on public.reports for select to authenticated using(true);
  create policy insert_reports on public.reports for insert to authenticated
    with check(user_id=auth.uid());
  create policy update_reports on public.reports for update to authenticated
    using(user_id=auth.uid() or public.jasida_pricing_admin())
    with check(user_id=auth.uid() or public.jasida_pricing_admin());
  set role authenticated; set test.uid='${user}';
`);
const row = async (id) => (await db.query(`select * from public.reports where id=${id}`)).rows[0];
const reject = async (sql, re) => assert.rejects(db.exec(sql), re);
await db.exec(`insert into public.reports(id) values(1);
  insert into public.reports(id,status) values(4,'pending_duplicate_review');`);
assert.equal((await row(1)).status, 'open');
console.log('PASS 1: normal open and pending_duplicate_review INSERT under synthetic RLS');
for (const status of ['resolved', 'in_progress', 'accepted', 'rejected']) {
  await reject(`insert into public.reports(id,status) values(99,'${status}')`, /verifikasi awal/);
}
await db.exec(`insert into public.reports(id,status,estimated_cost,estimated_materials,
  estimated_materials_json,estimate_details,estimate_recorded_at,actual_cost,
  actual_materials,actual_materials_json,actual_cost_evidence,actual_cost_verified,resolved_at)
  values(5,'open',100,'forged','[]','{}','2000-01-01',120,'forged','[]','fake',true,'2000-01-01');`);
const normalized = await row(5);
for (const key of [
  'estimated_cost',
  'estimated_materials',
  'estimated_materials_json',
  'estimate_details',
  'estimate_recorded_at',
  'actual_cost',
  'actual_materials',
  'actual_materials_json',
  'actual_cost_evidence',
  'resolved_at',
]) {
  assert.equal(normalized[key], null, key);
}
assert.equal(normalized.actual_cost_verified, false);
console.log('PASS 2: forged INSERT states rejected; all financial provenance normalized');
for (const assignment of [
  'estimated_cost=1',
  "estimated_materials='fake'",
  "estimate_details='{}'",
  "estimated_materials_json='[]'",
  'actual_cost=1',
  "actual_materials='fake'",
  "actual_materials_json='[]'",
  "actual_cost_evidence='fake'",
  'actual_cost_verified=true',
  "status='accepted'",
  "status='resolved'",
]) {
  await reject(`update public.reports set ${assignment} where id=1`, /admin/);
}
await db.exec(
  `update public.reports set estimate_recorded_at='2000-01-01',resolved_at='2000-01-01' where id=1`
);
assert.equal((await row(1)).resolved_at, null);
assert.equal((await row(1)).estimate_recorded_at, null);
console.log('PASS 3: non-admin cost/status writes rejected; timestamp spoofing ignored');
await db.exec(`set test.uid='${admin}'`);
await reject(`update public.reports set status='resolved' where id=1`, /in_progress/);
await reject(
  `update public.reports set status='in_progress',estimated_cost=100 where id=1`,
  /accepted/
);
await db.exec(`update public.reports set status='accepted' where id=1`);
for (const invalid of ['null', '-1', "'NaN'::numeric", "'Infinity'::numeric"]) {
  await reject(
    `update public.reports set status='in_progress',estimated_cost=${invalid} where id=1`,
    /valid/
  );
}
await db.exec(`update public.reports set status='in_progress',estimated_cost=100,
  estimated_materials_json='[]',estimate_recorded_at='2000-01-01' where id=1`);
const started = await row(1);
assert.ok(started.estimate_recorded_at);
assert.ok(new Date(started.estimate_recorded_at).getFullYear() > 2000);
await reject(`update public.reports set estimated_cost=80 where id=1`, /historis/);
await reject(`update public.reports set estimate_details='{}' where id=1`, /historis/);
await reject(`update public.reports set status='accepted' where id=1`, /hanya dapat/);
console.log('PASS 4: only accepted -> in_progress; finite estimate required and then locked');
await db.exec(
  `update public.reports set estimate_recorded_at='2000-01-01',resolved_at='2000-01-01' where id=1`
);
assert.deepEqual((await row(1)).estimate_recorded_at, started.estimate_recorded_at);
assert.equal((await row(1)).resolved_at, null);
console.log('PASS 5: server estimate timestamp cannot be rewritten');
await reject(
  `update public.reports set actual_cost_verified=true,actual_cost=120,actual_cost_evidence='nota' where id=1`,
  /penyelesaian/
);
for (const invalid of ['null', '-1', "'NaN'::numeric", "'Infinity'::numeric"]) {
  await reject(
    `update public.reports set status='resolved',actual_cost_verified=true,
    actual_cost=${invalid},actual_cost_evidence='nota' where id=1`,
    /bukti/
  );
}
await reject(
  `update public.reports set status='resolved',actual_cost=120,actual_cost_verified=true,
  actual_cost_evidence='   ' where id=1`,
  /bukti/
);
await db.exec(`update public.reports set status='resolved',actual_cost=120,actual_materials='receipt',
  actual_cost_verified=true,actual_cost_evidence='Nota test',resolved_at='2000-01-01' where id=1`);
const completed = await row(1);
assert.ok(new Date(completed.resolved_at) >= new Date(started.estimate_recorded_at));
assert.ok(new Date(completed.resolved_at).getFullYear() > 2000);
for (const id of [1, 2, 3]) {
  await reject(`update public.reports set status='open' where id=${id}`, /dibuka kembali/);
  for (const assignment of [
    'actual_cost=90',
    "actual_cost_evidence='changed'",
    "actual_materials='changed'",
    "actual_materials_json='[]'",
    'actual_cost_verified=true',
  ]) {
    if (id === 1 && assignment === 'actual_cost_verified=true') continue;
    await reject(`update public.reports set ${assignment} where id=${id}`, /ditimpa/);
  }
}
await db.exec(`update public.reports set resolved_at=null where id=1`);
assert.deepEqual((await row(1)).resolved_at, completed.resolved_at);
console.log(
  'PASS 6: completed/legacy rows cannot reopen or change actuals; server resolution time locked'
);
console.log(
  'PASS 7: verified completion requires finite nonnegative cost and referenceable evidence'
);
for (const id of [2, 3]) {
  assert.equal((await row(id)).estimate_recorded_at, null);
  assert.ok(!isEvaluationPair(await row(id)));
}
// Legitimate unverified completion remains excluded, with no silent later verification.
await db.exec(`update public.reports set status='accepted' where id=5;
  update public.reports set status='in_progress',estimated_cost=100 where id=5;
  update public.reports set status='resolved',actual_cost=120 where id=5;`);
assert.ok(!isEvaluationPair(await row(5)));
await reject(
  `update public.reports set actual_cost_verified=true,actual_cost_evidence='late' where id=5`,
  /ditimpa/
);
console.log('PASS 8: historical/unverified data excluded; no fabricated legacy provenance');
const insert = `insert into public.material_price_references(material_name,specification,unit,reference_price,reference_code,source_name,source_url,effective_year,price_type,tax_inclusion,verification_status) values ('Test','Test','kg',100,'TEST','Test','https://rds.sidoarjokab.go.id/',2026,'SSH','excluded','draft')`;
await db.exec(insert);
await db.exec('update public.material_price_references set reference_price=150');
assert.equal(
  Number(
    (await db.query('select reference_price from public.material_price_references')).rows[0]
      .reference_price
  ),
  150
);
await reject('delete from public.material_price_references', /permission denied/);
await db.exec(`set test.uid='${user}'`);
assert.equal((await db.query('select * from public.material_price_references')).rows.length, 0);
await reject(insert.replace("'TEST'", "'TEST2'"), /row-level security/);
assert.equal(
  (await db.query('update public.material_price_references set reference_price=200 returning id'))
    .rows.length,
  0
);
await db.exec(`reset role; set role anon;`);
await reject(`select * from public.material_price_references`, /permission denied/);
await db.exec(`reset role; set role service_role;`);
await reject(`select * from public.material_price_references`, /permission denied/);
await db.exec(`reset role;`);
await reject(`insert into public.reports(id,status) values(99,'resolved')`, /verifikasi awal/);
for (const role of ['anon', 'authenticated', 'service_role']) {
  const privileges = (
    await db.query(`select
    has_function_privilege('${role}','public.jasida_guard_cost_history()','execute') as guard,
    has_function_privilege('${role}','public.jasida_pricing_admin()','execute') as admin`)
  ).rows[0];
  assert.equal(privileges.guard, false);
  assert.equal(privileges.admin, role === 'authenticated');
}
assert.equal(
  (
    await db.query(`select count(*)::int as n from pg_proc where proname in
  ('jasida_pricing_admin','jasida_guard_cost_history') and proconfig @> array['search_path=""']`)
  ).rows[0].n,
  2
);
console.log('PASS 9: admin-only catalog RLS, anon denied, minimal EXECUTE and empty search_path');
console.log(
  'PASS 10: valid create -> accept -> start -> verified complete; migration applies twice'
);
await db.exec(`set role authenticated; set test.uid='${admin}';
  insert into public.reports(id,accepted_at,started_at,rejected_at) values(6,'2000-01-01','2000-01-01','2000-01-01');`);
for (const key of ['accepted_at', 'started_at', 'rejected_at'])
  assert.equal((await row(6))[key], null);
await db.exec(`update public.reports set status='rejected',rejected_at='2000-01-01' where id=6`);
const rejected = await row(6);
assert.ok(new Date(rejected.rejected_at).getFullYear() > 2000);
await db.exec(
  `update public.reports set rejected_at=null,accepted_at='2000-01-01',started_at='2000-01-01' where id=6`
);
assert.deepEqual((await row(6)).rejected_at, rejected.rejected_at);
assert.equal((await row(6)).accepted_at, null);
assert.equal((await row(6)).started_at, null);
assert.deepEqual(started.started_at, started.estimate_recorded_at);
assert.ok(new Date(started.accepted_at) <= new Date(started.started_at));
console.log('PASS: acceptance/start/rejection times are server-owned; no legacy backfill');
await db.close();
