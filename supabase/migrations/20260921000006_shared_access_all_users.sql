-- ==============================================================================
-- Migration: 20260921000006_shared_access_all_users.sql
-- Goal: Abolish role-based access & invite system; enable shared access for all authenticated users
-- ==============================================================================

-- 1. Clean up obsolete invites table and unused functions
drop table if exists public.dog_invites cascade;
drop function if exists public.create_invite_link(uuid, text);
drop function if exists public.accept_invite(text);
drop function if exists public.revoke_invite(uuid);
drop function if exists public.get_dog_invites(uuid);
drop function if exists public.set_dog_member_role(uuid, uuid, text);
drop function if exists public.remove_dog_member(uuid, uuid);
drop function if exists public.can_edit_dog(uuid);
drop function if exists public.is_dog_owner(uuid);

-- 2. Drop existing restrictive policies on dogs, schedules, logs, dog_members
drop policy if exists "members and owners can view dogs" on public.dogs;
drop policy if exists "members can view dogs" on public.dogs;
drop policy if exists "users can create owned dogs" on public.dogs;
drop policy if exists "owners can update dogs" on public.dogs;
drop policy if exists "owners can delete dogs" on public.dogs;
drop policy if exists "authenticated view dogs" on public.dogs;
drop policy if exists "authenticated insert dogs" on public.dogs;
drop policy if exists "authenticated update dogs" on public.dogs;
drop policy if exists "authenticated delete dogs" on public.dogs;

drop policy if exists "members view schedules" on public.schedules;
drop policy if exists "members manage schedules" on public.schedules;
drop policy if exists "editors and owners manage schedules" on public.schedules;
drop policy if exists "authenticated view schedules" on public.schedules;
drop policy if exists "authenticated insert schedules" on public.schedules;
drop policy if exists "authenticated update schedules" on public.schedules;
drop policy if exists "authenticated delete schedules" on public.schedules;

drop policy if exists "members view logs" on public.logs;
drop policy if exists "members manage logs" on public.logs;
drop policy if exists "caretakers and owners add logs" on public.logs;
drop policy if exists "caretakers and owners edit logs" on public.logs;
drop policy if exists "caretakers and owners delete logs" on public.logs;
drop policy if exists "authenticated view logs" on public.logs;
drop policy if exists "authenticated insert logs" on public.logs;
drop policy if exists "authenticated update logs" on public.logs;
drop policy if exists "authenticated delete logs" on public.logs;

drop policy if exists "members can view members" on public.dog_members;
drop policy if exists "owners manage members" on public.dog_members;
drop policy if exists "authenticated view dog_members" on public.dog_members;
drop policy if exists "authenticated manage dog_members" on public.dog_members;

-- 3. Open RLS Policies for Shared Access to ALL Authenticated Users
-- A. dogs:
alter table public.dogs enable row level security;

create policy "authenticated view dogs" on public.dogs
  for select using (auth.role() = 'authenticated');

create policy "authenticated insert dogs" on public.dogs
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated update dogs" on public.dogs
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated delete dogs" on public.dogs
  for delete using (auth.role() = 'authenticated');

-- B. schedules:
alter table public.schedules enable row level security;

create policy "authenticated view schedules" on public.schedules
  for select using (auth.role() = 'authenticated');

create policy "authenticated insert schedules" on public.schedules
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated update schedules" on public.schedules
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated delete schedules" on public.schedules
  for delete using (auth.role() = 'authenticated');

-- C. logs:
alter table public.logs enable row level security;

create policy "authenticated view logs" on public.logs
  for select using (auth.role() = 'authenticated');

create policy "authenticated insert logs" on public.logs
  for insert with check (auth.role() = 'authenticated' and by = auth.uid());

create policy "authenticated update logs" on public.logs
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated delete logs" on public.logs
  for delete using (auth.role() = 'authenticated');

-- D. dog_members (keep permissive backward compatibility)
alter table public.dog_members enable row level security;

create policy "authenticated view dog_members" on public.dog_members
  for select using (auth.role() = 'authenticated');

create policy "authenticated manage dog_members" on public.dog_members
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 4. Storage Policies: Allow all authenticated users to read and upload photos
drop policy if exists "members read dog photos" on storage.objects;
drop policy if exists "members upload dog photos" on storage.objects;
drop policy if exists "members update dog photos" on storage.objects;
drop policy if exists "members delete dog photos" on storage.objects;
drop policy if exists "authenticated read photos" on storage.objects;
drop policy if exists "authenticated upload photos" on storage.objects;
drop policy if exists "authenticated update photos" on storage.objects;
drop policy if exists "authenticated delete photos" on storage.objects;

create policy "authenticated read photos" on storage.objects
  for select using (
    bucket_id in ('dog-photos', 'meal-photos')
    and auth.role() = 'authenticated'
  );

create policy "authenticated upload photos" on storage.objects
  for insert with check (
    bucket_id in ('dog-photos', 'meal-photos')
    and auth.role() = 'authenticated'
  );

create policy "authenticated update photos" on storage.objects
  for update using (
    bucket_id in ('dog-photos', 'meal-photos')
    and auth.role() = 'authenticated'
  );

create policy "authenticated delete photos" on storage.objects
  for delete using (
    bucket_id in ('dog-photos', 'meal-photos')
    and auth.role() = 'authenticated'
  );

-- 5. Simplified create_dog RPC function (No membership restrictions)
create or replace function public.create_dog(dog_name text, dog_photo text default null)
returns public.dogs
language plpgsql
security definer
set search_path = public
as $$
declare
  new_dog public.dogs;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อนถึงจะเพิ่มน้องหมาได้';
  end if;

  if trim(dog_name) is null or length(trim(dog_name)) = 0 then
    raise exception 'กรุณาระบุชื่อน้องหมา';
  end if;

  -- Insert dog row
  insert into public.dogs (name, photo, owner_id)
  values (trim(dog_name), dog_photo, auth.uid())
  returning * into new_dog;

  -- Maintain dog_members for legacy author resolution
  insert into public.dog_members (dog_id, user_id, role)
  values (new_dog.id, auth.uid(), 'member')
  on conflict (dog_id, user_id) do nothing;

  return new_dog;
end;
$$;

grant execute on function public.create_dog(text, text) to authenticated;

-- 6. Helper RPC: get_app_users to resolve author email/name in shared mode
create or replace function public.get_app_users()
returns table (
  id uuid,
  email text
)
language sql
security definer
stable
set search_path = public, auth
as $$
  select id, email::text
  from auth.users
  where email is not null;
$$;

grant execute on function public.get_app_users() to authenticated;

-- 7. Realtime configuration
do $$ begin
  alter publication supabase_realtime add table public.dogs;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.schedules;
exception when duplicate_object then null;
end $$;

-- 8. Reload PostgREST schema cache
notify pgrst, 'reload schema';
