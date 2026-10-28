import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const admin = '00000000-0000-4000-8000-000000000001';
const user = '00000000-0000-4000-8000-000000000002';
await db.exec(`
create role authenticated; create role anon; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('test.uid',true),'')::uuid $$;
create table public.profiles(id uuid primary key,role text);
insert into public.profiles values('${admin}','admin'),('${user}','user');
create table public.reports(id integer primary key,user_id uuid,status text default 'open',
 estimated_cost numeric,actual_cost numeric,estimated_materials_json jsonb,
 estimated_materials text,actual_materials text,actual_materials_json jsonb,
 resolved_at timestamptz,accepted_at timestamptz,started_at timestamptz,
 rejected_at timestamptz,note text);
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
`);
const base = readFileSync(
  new URL('../../supabase/migrations/20261026_material_pricing.sql', import.meta.url),
  'utf8'
);
const migration = readFileSync(
  new URL('../../supabase/migrations/20261028_catalog_conflict_workflow.sql', import.meta.url),
  'utf8'
);
await db.exec(base);
try {
  await db.exec(migration);
  await db.exec(migration);
} catch (error) {
  console.error(error.message, error.position, error.line, error.column);
  if (error.position)
    console.error(migration.slice(Number(error.position) - 90, Number(error.position) + 90));
  process.exitCode = 1;
  await db.close();
  process.exit();
}
console.log('PASS catalog migration applies twice');
const row = {
  material_name: 'Semen Portland',
  specification: 'SNI',
  unit: 'kg',
  reference_price: 1960,
  reference_code: 'ABC-001',
  source_name: 'Dokumen Uji',
  source_url: 'https://rds.sidoarjokab.go.id/',
  effective_year: 2026,
  price_type: 'SSH',
  tax_inclusion: 'excluded',
  verification_status: 'verified',
  verified_at: '2000-01-01T00:00:00Z',
};
const rpc = async (rows, mode = 'create', target = null, confirmed = false, reason = null) =>
  (
    await db.query(
      `select public.jasida_save_price_references($1::jsonb,$2::text,$3::uuid,$4::boolean,$5::text) as result`,
      [JSON.stringify(rows), mode, target, confirmed, reason]
    )
  ).rows[0].result;
const get = async () =>
  (await db.query('select * from public.material_price_references order by reference_code')).rows;
const deny = async (fn, re) => assert.rejects(fn, re);
await db.exec("set role anon; set test.uid='';");
await deny(() => rpc([row]), /permission denied/);
await db.exec(`reset role; set role authenticated; set test.uid='${user}';`);
await deny(() => rpc([row]), /Hanya admin/);
assert.equal((await get()).length, 0);
await db.exec(`set test.uid='${admin}'`);
await deny(() => rpc([{}]), /metadata wajib diisi/);
await deny(() => rpc([{ ...row, reference_price: null }]), /harga atau tahun tidak valid/);
assert.deepEqual(await rpc([row]), { created: 1, unchanged: 0, verified: 0, edited: 0 });
let saved = await get();
assert.equal(saved[0].reference_code, 'ABC-001');
assert.equal(saved[0].verification_status, 'draft');
assert.equal(saved[0].verified_at, null);
console.log('PASS admin RPC creates draft; anon and user denied');
const first = saved[0];
assert.deepEqual(await rpc([{ ...row, reference_code: ' ABC-001 ' }]), {
  created: 0,
  unchanged: 1,
  verified: 0,
  edited: 0,
});
assert.deepEqual(await get(), saved);
for (const patch of [
  { reference_price: 2000 },
  { specification: 'Berbeda' },
  { unit: 'ton' },
  { source_url: 'https://sidoarjokab.go.id/lain' },
  { tax_inclusion: 'included' },
]) {
  await deny(() => rpc([{ ...row, ...patch }]), /Konflik referensi.*kolom berbeda/);
  assert.deepEqual(await get(), saved);
}
console.log('PASS identical no-op; price, specification, unit, URL, tax conflicts rejected');
await deny(() => rpc([row], 'verify', first.id), /dikonfirmasi/);
assert.deepEqual(await rpc([row], 'verify', first.id, true), {
  created: 0,
  unchanged: 0,
  verified: 1,
  edited: 0,
});
saved = await get();
assert.equal(saved[0].verification_status, 'verified');
assert.ok(saved[0].verified_at);
assert.deepEqual(await rpc([row], 'verify', first.id, true), {
  created: 0,
  unchanged: 1,
  verified: 0,
  edited: 0,
});
assert.deepEqual(await rpc([row], 'import'), {
  created: 0,
  unchanged: 1,
  verified: 0,
  edited: 0,
});
await deny(() => rpc([{ ...row, reference_price: 3000 }]), /Konflik referensi/);
await deny(
  () => rpc([{ ...row, reference_price: 3000 }], 'edit_draft', first.id),
  /Verified tidak dapat diubah/
);
assert.deepEqual(await get(), saved);
console.log('PASS admin confirmation required; verified row immutable');
const another = {
  ...row,
  material_name: 'Pasir Beton',
  specification: 'No. 4',
  unit: 'm3',
  reference_price: 347600,
  reference_code: 'ABC-002',
};
await deny(() => rpc([another, { ...row, reference_price: 3000 }], 'import'), /Konflik referensi/);
assert.deepEqual(await get(), saved);
await deny(() => rpc([another, another], 'import'), /duplikat identik/);
await deny(() => rpc([another, { ...another, reference_price: 1 }], 'import'), /Konflik baris/);
assert.deepEqual(await get(), saved);
console.log('PASS whole batch rejected for stored or intra-file conflicts');
const twin = { ...another, reference_code: 'ABC-003' };
await deny(() => rpc([another, twin], 'import'), /Kemungkinan duplikat/);
assert.deepEqual(await get(), saved);
const reason = 'Dua kode resmi berbeda untuk spesifikasi yang sama.';
assert.deepEqual(await rpc([another, twin], 'import', null, false, reason), {
  created: 2,
  unchanged: 0,
  verified: 0,
  edited: 0,
});
assert.equal((await get()).length, 3);
await db.exec('reset role');
const reviews = (await db.query('select * from public.material_price_review_decisions')).rows;
assert.ok(reviews.length >= 1);
assert.equal(reviews[0].reviewer_id, admin);
assert.equal(reviews[0].reason, reason);
console.log('PASS near duplicate requires recorded admin reason');
await db.exec(`set role authenticated; set test.uid='${admin}';`);
const draft = (await get()).find((r) => r.reference_code === 'ABC-002');
await deny(
  () => rpc([{ ...another, reference_code: 'ABC-001' }], 'edit_draft', draft.id),
  /Konflik referensi/
);
assert.deepEqual(
  await rpc([{ ...another, reference_price: 350000 }], 'edit_draft', draft.id, false, reason),
  { created: 0, unchanged: 0, verified: 0, edited: 1 }
);
assert.equal((await get()).find((r) => r.id === draft.id).verification_status, 'draft');
assert.equal(Number((await get()).find((r) => r.id === draft.id).reference_price), 350000);
console.log('PASS draft edit cannot collide with Verified identity and remains Draft');
const parallel = { ...another, material_name: 'Agregat Kasar', reference_code: 'ABC-005' };
const parallelResults = await Promise.all([rpc([parallel]), rpc([parallel])]);
assert.deepEqual(parallelResults.map((r) => r.created).sort(), [0, 1]);
assert.equal((await get()).filter((r) => r.reference_code === 'ABC-005').length, 1);
console.log('PASS paired requests create one row; normalized unique index remains final barrier');
await deny(
  () =>
    db.exec(`insert into public.material_price_references(material_name,specification,unit,reference_price,
 reference_code,source_name,source_url,effective_year,price_type,tax_inclusion,verification_status)
 values('Semen Portland','SNI','kg',1960,'ABC-004','Dokumen Uji','https://rds.sidoarjokab.go.id/',2026,'SSH','excluded','draft')`),
  /permission denied/
);
assert.equal((await get()).length, 4);
await db.exec('reset role');
await deny(
  () =>
    db.exec(`insert into public.material_price_references(material_name,specification,unit,reference_price,
 reference_code,source_name,source_url,effective_year,price_type,tax_inclusion,verification_status)
 values('Semen Portland','SNI','kg',1960,' ABC-001 ','Dokumen Uji','https://rds.sidoarjokab.go.id/',2026,'SSH','excluded','draft')`),
  /duplicate key/
);
console.log(
  'PASS direct client writes denied; normalized unique index rejects concurrent identities'
);
await db.exec(`set role authenticated; set test.uid='${user}';`);
assert.equal((await get()).length, 0);
await deny(
  () => db.exec('select * from public.material_price_review_decisions'),
  /permission denied/
);
await deny(() => rpc([row], 'verify', first.id, true), /Hanya admin/);
console.log('PASS non-admin cannot read catalog or review audit and cannot verify');
await db.close();
