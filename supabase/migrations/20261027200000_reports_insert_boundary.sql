-- Candidate for manual review/staging only. Independent of pending pricing/role SQL.
-- Inspect reports_hold_manual_location, reports_notify and creation RPCs before use.
-- Restrictive policy narrows existing permissive INSERT policies, without replacing
-- SELECT/UPDATE policies needed by public maps, image linking and support RPCs.
begin;
do $$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='reports' and column_name='user_id' and udt_name='uuid')
    or not exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='reports' and column_name='status') then
    raise exception 'Reports schema differs: review schema audit before applying';
  end if;
end $$;
alter table public.reports enable row level security;
drop policy if exists jasida_reports_insert_boundary on public.reports;
create policy jasida_reports_insert_boundary on public.reports as restrictive
for insert to public with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and status::text in ('open','pending_duplicate_review')
);
-- No new grants. Existing permissive INSERT policy/grants are still required.
-- Table owners/BYPASSRLS/SECURITY DEFINER paths must be audited independently.
-- This policy does NOT replace cost-history guards or validate financial columns.
commit;
