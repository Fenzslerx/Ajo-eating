-- ==============================================================================
-- Migration: 20260921000007_cleanup_and_fix_shared_access_rls.sql
-- Goal:
-- 1. ลบ Policy เก่าและฟังก์ชันตรวจสิทธิ์ทั้งหมดที่อาจค้างอยู่ในระบบ (is_dog_member, is_dog_owner, etc.)
-- 2. สร้าง Policy ใหม่สำหรับทุกตารางให้เป็น `auth.uid() is not null` (SELECT/INSERT/UPDATE/DELETE)
-- 3. ตรวจสอบ storage.objects ให้ใช้ `auth.uid() is not null`
-- ==============================================================================

-- ==============================================================================
-- PART 0: ลบตารางและฟังก์ชันเก่าที่ล้าสมัย
-- ==============================================================================
drop table if exists public.dog_invites cascade;
drop function if exists public.create_invite_link(uuid, text);
drop function if exists public.accept_invite(text);
drop function if exists public.revoke_invite(uuid);
drop function if exists public.get_dog_invites(uuid);
drop function if exists public.set_dog_member_role(uuid, uuid, text);
drop function if exists public.remove_dog_member(uuid, uuid);
drop function if exists public.can_edit_dog(uuid);
drop function if exists public.is_dog_owner(uuid);

-- ==============================================================================
-- PART 1: ลบ Policy เก่าทั้งหมดบน dogs
-- ==============================================================================
drop policy if exists "members can view dogs" on public.dogs;
drop policy if exists "members and owners can view dogs" on public.dogs;
drop policy if exists "users can create owned dogs" on public.dogs;
drop policy if exists "owners can update dogs" on public.dogs;
drop policy if exists "owners can delete dogs" on public.dogs;
drop policy if exists "authenticated view dogs" on public.dogs;
drop policy if exists "authenticated insert dogs" on public.dogs;
drop policy if exists "authenticated update dogs" on public.dogs;
drop policy if exists "authenticated delete dogs" on public.dogs;

-- ==============================================================================
-- PART 2: ลบ Policy เก่าทั้งหมดบน schedules
-- ==============================================================================
drop policy if exists "members manage schedules" on public.schedules;
drop policy if exists "members view schedules" on public.schedules;
drop policy if exists "editors manage schedules" on public.schedules;
drop policy if exists "editors and owners manage schedules" on public.schedules;
drop policy if exists "authenticated view schedules" on public.schedules;
drop policy if exists "authenticated insert schedules" on public.schedules;
drop policy if exists "authenticated update schedules" on public.schedules;
drop policy if exists "authenticated delete schedules" on public.schedules;

-- ==============================================================================
-- PART 3: ลบ Policy เก่าทั้งหมดบน logs
-- ==============================================================================
drop policy if exists "members manage logs" on public.logs;
drop policy if exists "members view logs" on public.logs;
drop policy if exists "editors add logs" on public.logs;
drop policy if exists "authors edit logs" on public.logs;
drop policy if exists "authors delete logs" on public.logs;
drop policy if exists "caretakers and owners add logs" on public.logs;
drop policy if exists "caretakers and owners edit logs" on public.logs;
drop policy if exists "caretakers and owners delete logs" on public.logs;
drop policy if exists "authenticated view logs" on public.logs;
drop policy if exists "authenticated insert logs" on public.logs;
drop policy if exists "authenticated update logs" on public.logs;
drop policy if exists "authenticated delete logs" on public.logs;

-- ==============================================================================
-- PART 4: ลบ Policy เก่าทั้งหมดบน dog_members
-- ==============================================================================
drop policy if exists "members can view members" on public.dog_members;
drop policy if exists "owners manage members" on public.dog_members;
drop policy if exists "authenticated view dog_members" on public.dog_members;
drop policy if exists "authenticated manage dog_members" on public.dog_members;


-- ==============================================================================
-- PART 6: สร้าง Policy ใหม่ (Shared Access - auth.uid() is not null)
-- ==============================================================================

-- A. Table: dogs
alter table public.dogs enable row level security;

create policy "authenticated view dogs" on public.dogs
  for select using (auth.uid() is not null);

create policy "authenticated insert dogs" on public.dogs
  for insert with check (auth.uid() is not null);

create policy "authenticated update dogs" on public.dogs
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated delete dogs" on public.dogs
  for delete using (auth.uid() is not null);

-- B. Table: schedules
alter table public.schedules enable row level security;

create policy "authenticated view schedules" on public.schedules
  for select using (auth.uid() is not null);

create policy "authenticated insert schedules" on public.schedules
  for insert with check (auth.uid() is not null);

create policy "authenticated update schedules" on public.schedules
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated delete schedules" on public.schedules
  for delete using (auth.uid() is not null);

-- C. Table: logs
alter table public.logs enable row level security;

create policy "authenticated view logs" on public.logs
  for select using (auth.uid() is not null);

create policy "authenticated insert logs" on public.logs
  for insert with check (auth.uid() is not null);

create policy "authenticated update logs" on public.logs
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated delete logs" on public.logs
  for delete using (auth.uid() is not null);

-- D. Table: dog_members (Permissive for all authenticated users)
alter table public.dog_members enable row level security;

create policy "authenticated view dog_members" on public.dog_members
  for select using (auth.uid() is not null);

create policy "authenticated manage dog_members" on public.dog_members
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- E. Storage: dog-photos & meal-photos
insert into storage.buckets (id, name, public)
values ('dog-photos', 'dog-photos', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do update set public = false;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'authenticated read photos'
  ) then
    create policy "authenticated read photos" on storage.objects
      for select using (
        bucket_id in ('dog-photos', 'meal-photos')
        and auth.uid() is not null
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'authenticated upload photos'
  ) then
    create policy "authenticated upload photos" on storage.objects
      for insert with check (
        bucket_id in ('dog-photos', 'meal-photos')
        and auth.uid() is not null
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'authenticated update photos'
  ) then
    create policy "authenticated update photos" on storage.objects
      for update using (
        bucket_id in ('dog-photos', 'meal-photos')
        and auth.uid() is not null
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'authenticated delete photos'
  ) then
    create policy "authenticated delete photos" on storage.objects
      for delete using (
        bucket_id in ('dog-photos', 'meal-photos')
        and auth.uid() is not null
      );
  end if;
end $$;

-- ==============================================================================
-- PART 7: Table schema adjustments (Make sure all client-used columns exist)
-- ==============================================================================
alter table public.dogs add column if not exists breed text;
alter table public.dogs add column if not exists birthdate text;

-- ==============================================================================
-- PART 8: Shared functions & cleanup obsolete invite functions
-- ==============================================================================
drop function if exists public.create_invite_link(uuid, text);
drop function if exists public.accept_invite(text);
drop function if exists public.revoke_invite(uuid);
drop function if exists public.get_dog_invites(uuid);
drop function if exists public.get_dog_members(uuid);

-- Update get_dog_members so any authenticated user can view members without membership check
create or replace function public.get_dog_members(target_dog_id uuid)
returns table (
  dog_id uuid,
  user_id uuid,
  role text,
  created_at timestamptz,
  email text
)
language sql
security definer
stable
as $$
  select 
    dm.dog_id,
    dm.user_id,
    dm.role::text,
    dm.created_at,
    u.email::text
  from public.dog_members dm
  left join auth.users u on u.id = dm.user_id
  where dm.dog_id = target_dog_id
  order by (case dm.role::text when 'owner' then 1 when 'caretaker' then 2 else 3 end), dm.created_at asc;
$$;

-- Update create_dog so breed and birthdate can be stored directly
create or replace function public.create_dog(
  dog_name text,
  dog_photo text default null,
  dog_breed text default null,
  dog_birthdate text default null
)
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

  insert into public.dogs (name, photo, owner_id, breed, birthdate)
  values (trim(dog_name), dog_photo, auth.uid(), trim(dog_breed), trim(dog_birthdate))
  returning * into new_dog;

  insert into public.dog_members (dog_id, user_id, role)
  values (new_dog.id, auth.uid(), 'owner')
  on conflict (dog_id, user_id) do update set role = 'owner';

  return new_dog;
end;
$$;

revoke all on function public.create_dog(text, text, text, text) from public;
grant execute on function public.create_dog(text, text, text, text) to authenticated;

-- Overload for backward compatibility with 2 arguments (dog_name, dog_photo)
create or replace function public.create_dog(
  dog_name text,
  dog_photo text
)
returns public.dogs
language sql
security definer
set search_path = public
as $$
  select public.create_dog(dog_name, dog_photo, null, null);
$$;

revoke all on function public.create_dog(text, text) from public;
grant execute on function public.create_dog(text, text) to authenticated;

-- ==============================================================================
-- PART 9: Ensure tables in supabase_realtime publication
-- ==============================================================================
do $$ begin
  alter publication supabase_realtime add table public.dogs;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.schedules;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.logs;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- ==============================================================================
-- PART 10: Reload PostgREST schema cache
-- ==============================================================================
notify pgrst, 'reload schema';

