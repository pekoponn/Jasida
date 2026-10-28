-- Review against the live pricing table before applying. No existing price row is changed.
-- This migration is required before deploying the form that calls its RPC.
begin;
set local search_path = '';

do $$
declare missing text;
begin
  if to_regclass('public.material_price_references') is null
     or to_regprocedure('public.jasida_pricing_admin()') is null then
    raise exception 'Migration harga dasar belum tersedia';
  end if;
  select string_agg(expected.name, ', ') into missing
  from (values ('id','uuid'),('material_name','text'),('specification','text'),
    ('unit','text'),('reference_price','numeric'),('reference_code','text'),
    ('source_name','text'),('source_url','text'),('effective_year','int4'),
    ('verified_at','timestamptz'),('price_type','text'),('tax_inclusion','text'),
    ('verification_status','text')) expected(name, typ)
  where not exists (
    select 1 from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid=a.attrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='material_price_references'
      and a.attname=expected.name and not a.attisdropped
      and a.atttypid=expected.typ::pg_catalog.regtype
  );
  if missing is not null then
    raise exception 'Skema katalog tidak cocok: %', missing;
  end if;
end $$;

-- The original unique constraint remains. This index also treats surrounding code
-- spaces as the same identity, including concurrent direct owner writes.
create unique index if not exists material_price_code_year_trimmed_idx
  on public.material_price_references ((pg_catalog.btrim(reference_code)), effective_year);

create table if not exists public.material_price_review_decisions (
  id bigint generated always as identity primary key,
  incoming_reference_code text not null,
  incoming_effective_year integer not null,
  compared_reference_code text not null,
  compared_effective_year integer not null,
  reviewer_id uuid not null,
  reason text not null check (pg_catalog.length(pg_catalog.btrim(reason)) >= 15),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table public.material_price_review_decisions enable row level security;
revoke all on public.material_price_review_decisions from public, anon, authenticated, service_role;
revoke all on sequence public.material_price_review_decisions_id_seq from public, anon, authenticated, service_role;

create or replace function public.jasida_price_fields(p_row jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'material_name',p_row->'material_name', 'specification',p_row->'specification',
    'unit',p_row->'unit', 'reference_price',p_row->'reference_price',
    'reference_code',p_row->'reference_code', 'source_name',p_row->'source_name',
    'source_url',p_row->'source_url', 'effective_year',p_row->'effective_year',
    'price_type',p_row->'price_type', 'tax_inclusion',p_row->'tax_inclusion')
$$;
create or replace function public.jasida_price_differences(p_old jsonb,p_new jsonb)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(pg_catalog.array_agg(k order by n),array[]::text[])
  from pg_catalog.unnest(array['material_name','specification','unit','reference_price',
    'reference_code','source_name','source_url','effective_year','price_type','tax_inclusion'])
    with ordinality as f(k,n)
  where p_old->k is distinct from p_new->k
$$;
create or replace function public.jasida_price_possible_duplicate(p_a jsonb,p_b jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p_a->>'reference_code' <> p_b->>'reference_code'
    and p_a->>'effective_year' = p_b->>'effective_year'
    and pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p_a->>'material_name'),'\s+',' ','g'))
      = pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p_b->>'material_name'),'\s+',' ','g'))
    and pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p_a->>'specification'),'\s+',' ','g'))
      = pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p_b->>'specification'),'\s+',' ','g'))
    and pg_catalog.lower(pg_catalog.btrim(p_a->>'unit')) = pg_catalog.lower(pg_catalog.btrim(p_b->>'unit'))
    and p_a->>'source_url' = p_b->>'source_url'
    and pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p_a->>'source_name'),'\s+',' ','g'))
      = pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p_b->>'source_name'),'\s+',' ','g'))
$$;
revoke all on function public.jasida_price_fields(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.jasida_price_differences(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.jasida_price_possible_duplicate(jsonb,jsonb) from public,anon,authenticated,service_role;

create or replace function public.jasida_save_price_references(
  p_rows jsonb, p_mode text, p_target uuid default null,
  p_confirmed boolean default false, p_review_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  raw jsonb;
  clean jsonb;
  prepared jsonb := '[]'::jsonb;
  previous jsonb;
  old public.material_price_references%rowtype;
  candidate public.material_price_references%rowtype;
  differences text[];
  idx integer;
  prior_idx integer;
  created_count integer := 0;
  unchanged_count integer := 0;
  actor uuid := auth.uid();
  has_similar boolean;
  reason text := pg_catalog.btrim(coalesce(p_review_reason,''));
begin
  if actor is null or not public.jasida_pricing_admin() then
    raise exception 'Hanya admin yang dapat menyimpan harga acuan';
  end if;
  if p_mode is null or p_mode not in ('create','import','edit_draft','verify') then
    raise exception 'Mode penyimpanan tidak valid';
  end if;
  if pg_catalog.jsonb_typeof(p_rows) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_rows) not between 1 and 200 then
    raise exception 'Isi harus berupa 1–200 referensi';
  end if;
  if p_mode <> 'import' and pg_catalog.jsonb_array_length(p_rows) <> 1 then
    raise exception 'Form hanya menyimpan satu referensi';
  end if;
  if (p_mode in ('edit_draft','verify')) <> (p_target is not null) then
    raise exception 'Target referensi tidak valid';
  end if;
  -- A table lock serializes this check with all catalog writers. The existing
  -- unique constraint and normalized-code index remain the final race barrier.
  lock table public.material_price_references in share row exclusive mode;
  if p_target is not null then
    select * into old from public.material_price_references where id=p_target for update;
    if not found then raise exception 'Referensi yang ditinjau tidak ditemukan'; end if;
  end if;
  for idx in 0..pg_catalog.jsonb_array_length(p_rows)-1 loop
    raw := p_rows->idx;
    if pg_catalog.jsonb_typeof(raw) is distinct from 'object' then
      raise exception 'Baris % harus berupa objek',idx+1;
    end if;
    if exists (select 1 from pg_catalog.unnest(array['material_name','specification','unit',
      'reference_code','source_name','source_url','price_type','tax_inclusion']) as f(k)
      where pg_catalog.jsonb_typeof(raw->k) is distinct from 'string'
        or pg_catalog.length(pg_catalog.btrim(raw->>k)) = 0) then
      raise exception 'Baris %: metadata wajib diisi sebagai teks',idx+1;
    end if;
    if pg_catalog.jsonb_typeof(raw->'reference_price') is distinct from 'number'
       or pg_catalog.jsonb_typeof(raw->'effective_year') is distinct from 'number'
       or raw->>'effective_year' !~ '^[0-9]{4}$' then
      raise exception 'Baris %: harga atau tahun tidak valid',idx+1;
    end if;
    clean := pg_catalog.jsonb_build_object(
      'material_name',pg_catalog.btrim(raw->>'material_name'),
      'specification',pg_catalog.btrim(raw->>'specification'),
      'unit',pg_catalog.lower(pg_catalog.btrim(raw->>'unit')),
      'reference_price',(raw->>'reference_price')::numeric,
      'reference_code',pg_catalog.btrim(raw->>'reference_code'),
      'source_name',pg_catalog.btrim(raw->>'source_name'),
      'source_url',pg_catalog.btrim(raw->>'source_url'),
      'effective_year',(raw->>'effective_year')::integer,
      'price_type',raw->>'price_type',
      'tax_inclusion',raw->>'tax_inclusion');
    if pg_catalog.length(clean->>'material_name') > 200
       or pg_catalog.length(clean->>'specification') > 500
       or pg_catalog.length(clean->>'reference_code') > 100
       or pg_catalog.length(clean->>'source_name') > 500
       or pg_catalog.length(clean->>'source_url') > 2048
       or (clean->>'reference_price')::numeric <= 0
       or (clean->>'reference_price')::numeric >= 1e15
       or (clean->>'effective_year')::integer not between 2000 and 2100
       or clean->>'unit' not in ('kg','ton','g','liter','ml','m3','m2','m','sak','buah','batang','lembar','pak','botol')
       or clean->>'price_type' not in ('SSH','HSPK')
       or clean->>'tax_inclusion' not in ('included','excluded','unknown')
       or clean->>'source_url' !~ '^https://([a-zA-Z0-9-]+\.)*sidoarjokab\.go\.id(/|$)' then
      raise exception 'Baris %: harga, satuan, tahun, sumber, atau metadata tidak valid',idx+1;
    end if;
    for prior_idx in 0..idx-1 loop
      previous := prepared->prior_idx;
      if clean->>'reference_code'=previous->>'reference_code'
         and clean->>'effective_year'=previous->>'effective_year' then
        differences := public.jasida_price_differences(previous,clean);
        if pg_catalog.cardinality(differences)=0 then
          raise exception 'Baris % duplikat identik dengan baris % (kode %, tahun %)',
            idx+1,prior_idx+1,clean->>'reference_code',clean->>'effective_year';
        end if;
        raise exception 'Konflik baris % dan %: kode %, tahun %, kolom berbeda: %',
          prior_idx+1,idx+1,clean->>'reference_code',clean->>'effective_year',
          pg_catalog.array_to_string(differences,', ');
      end if;
    end loop;
    prepared := prepared || pg_catalog.jsonb_build_array(clean);
  end loop;

  raw := prepared->0;
  if p_mode in ('edit_draft','verify') then
    if old.verification_status='verified' then
      if p_mode='verify' and pg_catalog.cardinality(public.jasida_price_differences(
        public.jasida_price_fields(pg_catalog.to_jsonb(old)),raw))=0 then
        return pg_catalog.jsonb_build_object('created',0,'unchanged',1,'verified',0,'edited',0);
      end if;
      raise exception 'Referensi Verified tidak dapat diubah; koreksi memerlukan alur audit khusus';
    end if;
    if p_mode='verify' then
      differences := public.jasida_price_differences(
        public.jasida_price_fields(pg_catalog.to_jsonb(old)),raw);
      if pg_catalog.cardinality(differences)>0 then
        raise exception 'Data Draft berubah selama peninjauan. Kolom berbeda: %',
          pg_catalog.array_to_string(differences,', ');
      end if;
      if p_confirmed is distinct from true then
        raise exception 'Pemeriksaan sumber oleh admin harus dikonfirmasi';
      end if;
      select exists (
        select 1 from public.material_price_references r
        where r.id<>p_target
          and public.jasida_price_possible_duplicate(pg_catalog.to_jsonb(r),raw)
      ) into has_similar;
      if has_similar and pg_catalog.length(reason)<15 then
        raise exception 'Kemungkinan duplikat material: % (%). Tinjau kedua kode dan isi alasan minimal 15 karakter.',
          raw->>'material_name',raw->>'reference_code';
      end if;
      -- The audit insert and status update run in one transaction. Any audit
      -- failure rolls back the entire verification.
      insert into public.material_price_review_decisions(incoming_reference_code,
        incoming_effective_year,compared_reference_code,compared_effective_year,reviewer_id,reason)
      select raw->>'reference_code',(raw->>'effective_year')::integer,
        r.reference_code,r.effective_year,actor,reason
      from public.material_price_references r
      where r.id<>p_target
        and public.jasida_price_possible_duplicate(pg_catalog.to_jsonb(r),raw);
      update public.material_price_references set verification_status='verified',
        verified_at=pg_catalog.clock_timestamp() where id=p_target;
      return pg_catalog.jsonb_build_object('created',0,'unchanged',0,'verified',1,'edited',0);
    end if;
  end if;

  -- Validate every row and every conflict before making any write.
  for idx in 0..pg_catalog.jsonb_array_length(prepared)-1 loop
    clean := prepared->idx;
    select * into candidate from public.material_price_references
      where pg_catalog.btrim(reference_code)=clean->>'reference_code'
        and effective_year=(clean->>'effective_year')::integer
        and (p_target is null or id <> p_target)
      limit 1;
    if found then
      differences := public.jasida_price_differences(
        public.jasida_price_fields(pg_catalog.to_jsonb(candidate)),clean);
      if pg_catalog.cardinality(differences)>0 then
        raise exception 'Konflik referensi: kode %, tahun %, kolom berbeda: %',
          clean->>'reference_code',clean->>'effective_year',
          pg_catalog.array_to_string(differences,', ');
      end if;
      if p_mode='edit_draft' then
        raise exception 'Kode % dan tahun % sudah dipakai referensi lain',
          clean->>'reference_code',clean->>'effective_year';
      end if;
      unchanged_count := unchanged_count+1;
    end if;
    if p_mode='edit_draft' and p_target is not null then
      differences := public.jasida_price_differences(
        public.jasida_price_fields(pg_catalog.to_jsonb(old)),clean);
      if pg_catalog.cardinality(differences)=0 then
        return pg_catalog.jsonb_build_object('created',0,'unchanged',1,'verified',0,'edited',0);
      end if;
    end if;
  end loop;

  for idx in 0..pg_catalog.jsonb_array_length(prepared)-1 loop
    clean := prepared->idx;
    if p_mode='import' or p_mode='create' then
      select true into has_similar from public.material_price_references
        where public.jasida_price_possible_duplicate(pg_catalog.to_jsonb(material_price_references),clean)
          and not exists (select 1 from public.material_price_references exact_row
            where pg_catalog.btrim(exact_row.reference_code)=clean->>'reference_code'
              and exact_row.effective_year=(clean->>'effective_year')::integer)
        limit 1;
    else
      select true into has_similar from public.material_price_references
        where id<>p_target
          and public.jasida_price_possible_duplicate(pg_catalog.to_jsonb(material_price_references),clean)
        limit 1;
    end if;
    if coalesce(has_similar,false) or exists (
      select 1 from pg_catalog.jsonb_array_elements(prepared) with ordinality as p(item,ordinal)
      where ordinal<>idx+1 and public.jasida_price_possible_duplicate(p.item,clean)
    ) then
      if pg_catalog.length(reason)<15 then
        raise exception 'Kemungkinan duplikat material: % (%). Tinjau kedua kode dan isi alasan minimal 15 karakter.',
          clean->>'material_name',clean->>'reference_code';
      end if;
    end if;
  end loop;

  for idx in 0..pg_catalog.jsonb_array_length(prepared)-1 loop
    clean := prepared->idx;
    if p_mode in ('create','import') then
      if exists (select 1 from public.material_price_references
        where pg_catalog.btrim(reference_code)=clean->>'reference_code'
          and effective_year=(clean->>'effective_year')::integer) then
        continue;
      end if;
      insert into public.material_price_references(material_name,specification,unit,
        reference_price,reference_code,source_name,source_url,effective_year,
        verified_at,price_type,tax_inclusion,verification_status)
      values (clean->>'material_name',clean->>'specification',clean->>'unit',
        (clean->>'reference_price')::numeric,clean->>'reference_code',
        clean->>'source_name',clean->>'source_url',(clean->>'effective_year')::integer,
        null,clean->>'price_type',clean->>'tax_inclusion','draft');
      created_count := created_count+1;
    else
      update public.material_price_references set material_name=clean->>'material_name',
        specification=clean->>'specification',unit=clean->>'unit',
        reference_price=(clean->>'reference_price')::numeric,
        reference_code=clean->>'reference_code',source_name=clean->>'source_name',
        source_url=clean->>'source_url',effective_year=(clean->>'effective_year')::integer,
        price_type=clean->>'price_type',tax_inclusion=clean->>'tax_inclusion'
      where id=p_target and verification_status='draft';
    end if;
    if pg_catalog.length(reason)>=15 then
      insert into public.material_price_review_decisions(incoming_reference_code,
        incoming_effective_year,compared_reference_code,compared_effective_year,reviewer_id,reason)
      select clean->>'reference_code',(clean->>'effective_year')::integer,
        r.reference_code,r.effective_year,actor,reason
      from public.material_price_references r
      where (p_target is null or r.id<>p_target)
        and public.jasida_price_possible_duplicate(pg_catalog.to_jsonb(r),clean)
        and r.reference_code<>clean->>'reference_code';
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('created',created_count,'unchanged',unchanged_count,
    'verified',0,'edited',case when p_mode='edit_draft' then 1 else 0 end);
exception when unique_violation then
  raise exception 'Konflik referensi: kode item dan tahun berlaku sudah terdaftar';
end $$;
revoke all on function public.jasida_save_price_references(jsonb,text,uuid,boolean,text)
  from public,anon,authenticated,service_role;
grant execute on function public.jasida_save_price_references(jsonb,text,uuid,boolean,text)
  to authenticated;

-- Client writes go only through the admin-checking RPC. Revoke any old column
-- grants as well as table grants; owner/service operations remain separate.
revoke insert,update,delete on public.material_price_references
  from public,anon,authenticated,service_role;
do $$
declare a record;
begin
  for a in select attname from pg_catalog.pg_attribute
    where attrelid='public.material_price_references'::pg_catalog.regclass
      and attnum>0 and not attisdropped loop
    execute pg_catalog.format(
      'revoke insert (%I), update (%I) on public.material_price_references from public,anon,authenticated,service_role',
      a.attname,a.attname);
  end loop;
end $$;
commit;
