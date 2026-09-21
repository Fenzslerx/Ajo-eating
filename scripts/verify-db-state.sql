-- ==============================================================================
-- scripts/verify-db-state.sql
-- Run this directly in Supabase Dashboard > SQL Editor
-- It outputs 5 distinct query results to verify exact database state.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Actual columns of target tables (public.dogs, logs, schedules, notifications, dog_members, dog_invites)
-- ------------------------------------------------------------------------------
select 
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('dogs', 'logs', 'schedules', 'notifications', 'dog_members', 'dog_invites')
order by table_name, ordinal_position;

-- ------------------------------------------------------------------------------
-- 2. All RLS policies on public schema tables and storage.objects
-- ------------------------------------------------------------------------------
select 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where (schemaname = 'public' and tablename in ('dogs', 'logs', 'schedules', 'notifications', 'dog_members', 'dog_invites'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- ------------------------------------------------------------------------------
-- 3. Functions in public schema
-- ------------------------------------------------------------------------------
select 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  p.prosecdef as is_security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_dog_member',
    'is_dog_editor',
    'is_dog_owner',
    'can_edit_dog',
    'create_dog',
    'get_dog_members',
    'get_app_users',
    'create_invite_link',
    'accept_invite',
    'revoke_invite',
    'get_dog_invites',
    'set_dog_member_role',
    'remove_dog_member',
    'extract_dog_id_from_storage_path',
    'check_missed_meals',
    'add_dog_owner'
  )
order by p.proname;

-- ------------------------------------------------------------------------------
-- 4. Storage buckets and public flag
-- ------------------------------------------------------------------------------
select 
  id,
  name,
  public,
  avif_autodetection,
  file_size_limit,
  allowed_mime_types
from storage.buckets
order by id;

-- ------------------------------------------------------------------------------
-- 5. Cron jobs in cron.job (pg_cron)
-- ------------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 
    from information_schema.tables 
    where table_schema = 'cron' and table_name = 'job'
  ) then
    -- Table exists, pg_cron is enabled
    null;
  end if;
end $$;

select 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
from cron.job
order by jobid;
