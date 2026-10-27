-- Apply manually after reviewing against the existing production schema.
-- Additive: no reset, no backfill of historical estimates.
begin;
create or replace function public.jasida_pricing_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;
revoke all on function public.jasida_pricing_admin() from public, anon, authenticated, service_role;
grant execute on function public.jasida_pricing_admin() to authenticated;

create table if not exists public.material_price_references (
  id uuid primary key default gen_random_uuid(),
  material_name text not null check (length(trim(material_name)) > 0),
  specification text not null check (length(trim(specification)) > 0),
  unit text not null check (length(trim(unit)) > 0),
  reference_price numeric not null check (reference_price > 0 and reference_price < 1e15),
  reference_code text not null check (length(trim(reference_code)) > 0),
  source_name text not null check (length(trim(source_name)) > 0),
  source_url text not null check (source_url ~ '^https://([a-zA-Z0-9-]+\.)*sidoarjokab\.go\.id(/|$)'),
  effective_year integer not null check (effective_year between 2000 and 2100),
  verified_at timestamptz,
  price_type text not null check (price_type in ('SSH','HSPK')),
  tax_inclusion text not null check (tax_inclusion in ('included','excluded','unknown')),
  verification_status text not null check (verification_status in ('draft','verified')),
  check (verification_status <> 'verified' or verified_at is not null),
  unique(reference_code,effective_year)
);
alter table public.material_price_references enable row level security;
revoke all on public.material_price_references from public, anon, authenticated, service_role;
grant select, insert, update on public.material_price_references to authenticated;
drop policy if exists pricing_admin_read on public.material_price_references;
create policy pricing_admin_read on public.material_price_references for select to authenticated using (public.jasida_pricing_admin());
drop policy if exists pricing_admin_insert on public.material_price_references;
create policy pricing_admin_insert on public.material_price_references for insert to authenticated with check (public.jasida_pricing_admin());
drop policy if exists pricing_admin_update on public.material_price_references;
create policy pricing_admin_update on public.material_price_references for update to authenticated using (public.jasida_pricing_admin()) with check (public.jasida_pricing_admin());

alter table public.reports add column if not exists estimate_recorded_at timestamptz;
alter table public.reports add column if not exists estimate_details jsonb;
alter table public.reports add column if not exists actual_cost_verified boolean not null default false;
alter table public.reports add column if not exists actual_cost_evidence text;

-- No client/backend INSERT bypass: all new reports begin in an intake state.
-- Historical records are never backfilled. Corrections/reopening require a future,
-- separately reviewed audited workflow; ordinary UPDATE cannot perform them.
create or replace function public.jasida_guard_cost_history() returns trigger
language plpgsql set search_path = '' as $$
declare
  estimate_changed boolean;
  actual_changed boolean;
begin
  if TG_OP = 'INSERT' then
    if NEW.status is null or NEW.status not in ('open','pending_duplicate_review') then
      raise exception 'Laporan baru wajib melalui verifikasi awal';
    end if;
    -- Normalize all financial provenance, including for admin/service callers.
    NEW.estimated_cost := null;
    NEW.estimated_materials := null;
    NEW.estimated_materials_json := null;
    NEW.estimate_details := null;
    NEW.estimate_recorded_at := null;
    NEW.actual_cost := null;
    NEW.actual_materials := null;
    NEW.actual_materials_json := null;
    NEW.actual_cost_evidence := null;
    NEW.actual_cost_verified := false;
    NEW.resolved_at := null;
    NEW.accepted_at := null;
    NEW.started_at := null;
    NEW.rejected_at := null;
    return NEW;
  end if;

  estimate_changed := NEW.estimated_cost is distinct from OLD.estimated_cost
    or NEW.estimated_materials_json is distinct from OLD.estimated_materials_json
    or NEW.estimated_materials is distinct from OLD.estimated_materials
    or NEW.estimate_details is distinct from OLD.estimate_details;
  actual_changed := NEW.actual_cost is distinct from OLD.actual_cost
    or NEW.actual_materials is distinct from OLD.actual_materials
    or NEW.actual_materials_json is distinct from OLD.actual_materials_json
    or NEW.actual_cost_verified is distinct from OLD.actual_cost_verified
    or NEW.actual_cost_evidence is distinct from OLD.actual_cost_evidence;

  -- Terminal even for legacy resolved rows with no timestamp; never fabricate it.
  if OLD.status = 'resolved' or OLD.resolved_at is not null then
    if NEW.status is distinct from OLD.status then
      raise exception 'Laporan selesai tidak dapat dibuka kembali melalui UPDATE biasa';
    end if;
    if actual_changed then raise exception 'Realisasi selesai tidak dapat ditimpa melalui alur ini'; end if;
  end if;
  if NEW.status is distinct from OLD.status then
    if not public.jasida_pricing_admin() then raise exception 'Hanya admin dapat mengubah status'; end if;
    if NEW.status is null then raise exception 'Status wajib diisi'; end if;
    if NEW.status = 'in_progress' and OLD.status is distinct from 'accepted' then
      raise exception 'Pengerjaan hanya dapat dimulai dari status accepted';
    end if;
    if NEW.status = 'resolved' and OLD.status is distinct from 'in_progress' then
      raise exception 'Penyelesaian hanya dapat dilakukan dari status in_progress';
    end if;
    if OLD.status = 'in_progress' and NEW.status <> 'resolved' then
      raise exception 'Pekerjaan berjalan hanya dapat beralih ke resolved';
    end if;
  end if;
  if estimate_changed then
    if not public.jasida_pricing_admin() then raise exception 'Hanya admin dapat menyimpan estimasi'; end if;
    if OLD.status in ('in_progress','resolved') or OLD.estimate_recorded_at is not null or OLD.resolved_at is not null then
      raise exception 'Estimasi historis tidak dapat ditimpa setelah pengerjaan dimulai';
    end if;
    if NEW.status = 'resolved' then raise exception 'Estimasi tidak boleh dibuat saat penyelesaian'; end if;
  end if;
  -- Ignore client timestamps, including on unrelated updates.
  NEW.estimate_recorded_at := OLD.estimate_recorded_at;
  NEW.resolved_at := OLD.resolved_at;
  NEW.accepted_at := OLD.accepted_at;
  NEW.started_at := OLD.started_at;
  NEW.rejected_at := OLD.rejected_at;
  -- Event times, not flags: retain prior rejection/acceptance history on later transitions.
  if NEW.status = 'accepted' and OLD.status is distinct from 'accepted' then
    NEW.accepted_at := pg_catalog.clock_timestamp();
  end if;
  if NEW.status = 'rejected' and OLD.status is distinct from 'rejected' then
    NEW.rejected_at := pg_catalog.clock_timestamp();
  end if;
  if NEW.status = 'in_progress' and OLD.status is distinct from 'in_progress' then
    if NEW.estimated_cost is null or not (NEW.estimated_cost >= 0 and NEW.estimated_cost < 'Infinity'::numeric) then
      raise exception 'Estimasi biaya wajib valid';
    end if;
    NEW.estimate_recorded_at := pg_catalog.clock_timestamp();
    NEW.started_at := NEW.estimate_recorded_at;
  end if;
  if actual_changed then
    if not public.jasida_pricing_admin() then raise exception 'Hanya admin dapat mencatat realisasi'; end if;
    if NEW.status is distinct from 'resolved' or OLD.status is distinct from 'in_progress' then
      raise exception 'Realisasi hanya dapat dicatat saat penyelesaian pekerjaan';
    end if;
  end if;
  if NEW.status = 'resolved' and OLD.status is distinct from 'resolved' then
    NEW.resolved_at := pg_catalog.clock_timestamp();
    if NEW.actual_cost_verified and (
      NEW.actual_cost is null or not (NEW.actual_cost >= 0 and NEW.actual_cost < 'Infinity'::numeric)
      or pg_catalog.length(pg_catalog.btrim(coalesce(NEW.actual_cost_evidence,''))) = 0
    ) then
      raise exception 'Realisasi terverifikasi memerlukan biaya valid dan referensi bukti';
    end if;
  end if;
  return NEW;
end $$;
-- A trigger is invoked by the database, not exposed as an application RPC.
revoke all on function public.jasida_guard_cost_history() from public, anon, authenticated, service_role;
drop trigger if exists jasida_guard_cost_history on public.reports;
create trigger jasida_guard_cost_history before insert or update on public.reports for each row execute function public.jasida_guard_cost_history();
commit;
