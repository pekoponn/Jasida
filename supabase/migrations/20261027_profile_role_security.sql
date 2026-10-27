-- Manual, independently reviewable migration. No dependency on material pricing.
-- Do NOT run a migration runner: the older pricing migration may still be pending.
begin;
-- Match existing application profile fields; fail transactionally on schema mismatch.
do $$
begin
  if (select count(*) from information_schema.columns where table_schema='public'
      and table_name='profiles' and column_name in ('id','role','username','full_name','avatar_url','created_at')) <> 6 then
    raise exception 'Profile schema differs: obtain schema audit before applying';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='profiles' and column_name='id' and udt_name='uuid')
     or not exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='profiles' and column_name='role' and udt_name in ('text','varchar')) then
    raise exception 'Profile id/role types differ: review exported schema first';
  end if;
end $$;

-- Remove table AND pre-existing column UPDATE/INSERT/DELETE privileges. Profiles
-- are created by the trusted auth trigger, never by the browser in this application.
revoke update, insert, delete on public.profiles from public, anon, authenticated;
do $$
declare c record;
begin
  for c in select attname from pg_catalog.pg_attribute
    where attrelid='public.profiles'::regclass and attnum>0 and not attisdropped loop
    execute pg_catalog.format('revoke update (%I), insert (%I) on public.profiles from public, anon, authenticated',c.attname,c.attname);
  end loop;
end $$;
grant update (username,full_name,avatar_url) on public.profiles to authenticated;
alter table public.profiles enable row level security;
-- Restrictive policy intersects existing permissive policies; it does not silently
-- grant access if the production self-edit permissive policy is absent.
drop policy if exists jasida_profile_self_edit_boundary on public.profiles;
create policy jasida_profile_self_edit_boundary on public.profiles as restrictive
  for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

create table if not exists public.profile_role_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  target_id uuid not null,
  old_role text,
  new_role text not null check (new_role in ('user','admin')),
  changed_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table public.profile_role_audit enable row level security;
revoke all on public.profile_role_audit from public,anon,authenticated,service_role;
revoke all on sequence public.profile_role_audit_id_seq from public,anon,authenticated,service_role;
-- Audit records are read by trusted database operators; no client mutation/read API.
create or replace function public.jasida_set_user_role(p_user_id uuid,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  previous_role text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_user_id is null or p_role is null or p_role not in ('user','admin') then
    raise exception 'Invalid target or role' using errcode='22023';
  end if;
  -- Serialize role changes, then recheck caller privileges after any wait.
  -- Also blocks concurrent profile DELETE/UPDATE by other database sessions.
  lock table public.profiles in share row exclusive mode;
  if not exists(select 1 from public.profiles where id=actor and role='admin') then
    raise exception 'Only authenticated admins may change roles' using errcode='42501';
  end if;
  select role into previous_role from public.profiles where id=p_user_id;
  if not found then raise exception 'Profile not found' using errcode='22023'; end if;
  if previous_role='admin' and p_role<>'admin'
     and (select count(*) from public.profiles where role='admin') <= 1 then
    raise exception 'Cannot remove the last admin' using errcode='42501';
  end if;
  if actor=p_user_id then raise exception 'Cannot change your own role' using errcode='42501'; end if;
  if previous_role is distinct from p_role then
    update public.profiles set role=p_role where id=p_user_id;
    insert into public.profile_role_audit(actor_id,target_id,old_role,new_role)
      values(actor,p_user_id,previous_role,p_role);
  end if;
  return pg_catalog.jsonb_build_object('id',p_user_id,'role',p_role);
end $$;
revoke all on function public.jasida_set_user_role(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.jasida_set_user_role(uuid,text) to authenticated;
commit;
