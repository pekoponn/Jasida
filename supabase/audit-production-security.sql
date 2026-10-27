-- READ ONLY. Export schema/security metadata, not user rows or secrets.
-- Run manually under a separately approved audit procedure. No migration runner.
select n.nspname as schema_name,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
  pg_catalog.pg_get_userbyid(c.relowner) as owner,c.reloptions,c.relacl
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and c.relname in ('profiles','reports','reports_with_coords','report_photos','report_supports','notifications','material_price_references'))
   or (n.nspname='storage' and c.relname in ('objects','buckets'));
select table_schema,table_name,column_name,udt_schema,udt_name,is_nullable,column_default
from information_schema.columns
where (table_schema='public' and table_name in ('profiles','reports','report_photos','report_supports','notifications','material_price_references'))
   or (table_schema='storage' and table_name in ('objects','buckets'))
order by table_schema,table_name,ordinal_position;
select schemaname,tablename,policyname,roles,permissive,cmd,qual,with_check
from pg_catalog.pg_policies where schemaname in ('public','storage')
order by schemaname,tablename,policyname;
select grantee,table_schema,table_name,privilege_type from information_schema.table_privileges
where table_schema in ('public','storage') order by table_schema,table_name,grantee;
select grantee,table_schema,table_name,column_name,privilege_type from information_schema.column_privileges
where table_schema in ('public','storage') order by table_schema,table_name,grantee,column_name;
select p.oid::regprocedure as signature,pg_catalog.pg_get_userbyid(p.proowner) as owner,
  p.prosecdef,p.proconfig,p.proacl,pg_catalog.pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f'
  and (p.prosecdef or p.proname in ('is_admin','notify_admins','reports_notify',
    'create_disputed_report','admin_resolve_duplicate_review','set_report_location_meta',
    'find_similar_reports','support_report','add_reporter','jasida_set_user_role',
    'jasida_pricing_admin','jasida_guard_cost_history'))
order by p.oid::regprocedure::text;
select n.nspname as schema_name,c.relname,t.tgname,pg_catalog.pg_get_triggerdef(t.oid) as definition,
  t.tgfoid::regprocedure as function_name,t.tgenabled
from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname in ('public','auth','storage');
select schemaname,viewname,definition from pg_catalog.pg_views
where schemaname='public';
select conrelid::regclass as relation,conname,pg_catalog.pg_get_constraintdef(oid) as definition
from pg_catalog.pg_constraint where connamespace='public'::regnamespace;
select rolname,rolsuper,rolbypassrls,rolinherit from pg_catalog.pg_roles
where rolname in ('anon','authenticated','service_role','postgres','supabase_admin');
select granted.rolname as granted_role,member.rolname as member_role
from pg_catalog.pg_auth_members m join pg_catalog.pg_roles granted on granted.oid=m.roleid
join pg_catalog.pg_roles member on member.oid=m.member;
select r.rolname,p.oid::regprocedure as function_signature,
  pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE') as can_execute
from pg_catalog.pg_roles r cross join pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where r.rolname in ('anon','authenticated','service_role') and n.nspname='public'
  and p.proname in ('is_admin','notify_admins','reports_notify','jasida_set_user_role');
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='report-images';
-- Presence first. Query history below separately only if this relation exists.
select pg_catalog.to_regclass('supabase_migrations.schema_migrations') as migration_history;
select table_schema,table_name,column_name from information_schema.columns
where table_schema='supabase_migrations' and table_name='schema_migrations';
-- If present, run separately: SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
-- Never run migration repair merely because manual SQL has no history entry.
