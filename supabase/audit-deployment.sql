-- Read-only. Run in Supabase SQL Editor to inspect actual settings.
-- Storage rows/files are not modified. Monthly egress is in Organization > Usage.

select id, public, file_size_limit, allowed_mime_types
from storage.buckets;

select bucket_id, count(*) as file_count,
  coalesce(sum((metadata->>'size')::bigint), 0) as total_bytes
from storage.objects
group by bucket_id;

select pg_database_size(current_database()) as database_bytes;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in
  ('reports', 'profiles', 'comments', 'report_photos', 'report_supports'))
  or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select n.nspname as schema_name, c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in
  ('reports', 'profiles', 'comments', 'report_photos', 'report_supports');
