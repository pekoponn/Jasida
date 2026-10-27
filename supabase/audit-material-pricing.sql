-- READ ONLY: inspect production/staging before applying the pricing migration.
-- This file is deliberately NOT a migration and was not run against production.
select table_name, column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name in ('reports','profiles','report_photos')
order by table_name, ordinal_position;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('reports','profiles','report_photos','material_price_references')
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('reports','profiles','report_photos','material_price_references')
order by table_name, grantee, privilege_type;

select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('reports','profiles','report_photos')
order by table_name, grantee, column_name;

select p.oid::regprocedure as function_name, pg_catalog.pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer, p.proconfig, p.proacl,
  pg_catalog.pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'jasida_pricing_admin','jasida_guard_cost_history','create_disputed_report',
  'admin_resolve_duplicate_review','set_report_location_meta','support_report','add_reporter'
)
order by p.proname;

select c.relname, t.tgname, pg_catalog.pg_get_triggerdef(t.oid) as definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('reports','profiles','report_photos') and not t.tgisinternal
order by c.relname, t.tgname;

select c.relname, c.relrowsecurity, c.relforcerowsecurity,
  pg_catalog.pg_get_userbyid(c.relowner) as owner
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relname in ('reports','profiles','report_photos','material_price_references');

select c.conname, pg_catalog.pg_get_constraintdef(c.oid) as definition
from pg_catalog.pg_constraint c
where c.conrelid = 'public.reports'::regclass;

-- Existing inconsistencies are review items, never automatically backfilled.
select status, count(*) as reports,
  count(*) filter (where resolved_at is not null) as with_resolution_timestamp
from public.reports group by status order by status;

-- Storage evidence policies and lifecycle consistency (read-only).
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies where schemaname='storage' and tablename in ('objects','buckets');
select status, count(*) as inconsistent_event_order
from public.reports
where (accepted_at is not null and started_at < accepted_at)
   or (started_at is not null and resolved_at < started_at)
group by status;
