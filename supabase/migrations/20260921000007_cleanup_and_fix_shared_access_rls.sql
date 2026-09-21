-- ==============================================================================
-- Migration: 20260921000007_cleanup_and_fix_shared_access_rls.sql
-- Goal:
-- 1. ลบ Policy เก่าและฟังก์ชันตรวจสิทธิ์ทั้งหมดที่อาจค้างอยู่ในระบบ (is_dog_member, is_dog_owner, etc.)
-- 2. สร้าง Policy ใหม่สำหรับทุกตารางให้เป็น `auth.uid() is not null` (SELECT/INSERT/UPDATE/DELETE)
-- 3. ตรวจสอบ storage.objects ให้ใช้ `auth.uid() is not null`
-- ==============================================================================

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
-- PART 5: ลบ Policy เก่าทั้งหมดบน storage.objects
-- ==============================================================================
drop policy if exists "members read dog photos" on storage.objects;
drop policy if exists "members upload dog photos" on storage.objects;
drop policy if exists "members update dog photos" on storage.objects;
drop policy if exists "members delete dog photos" on storage.objects;
drop policy if exists "members read meal photos" on storage.objects;
drop policy if exists "members upload meal photos" on storage.objects;
drop policy if exists "members update meal photos" on storage.objects;
drop policy if exists "members delete meal photos" on storage.objects;
drop policy if exists "authenticated read photos" on storage.objects;
drop policy if exists "authenticated upload photos" on storage.objects;
drop policy if exists "authenticated update photos" on storage.objects;
drop policy if exists "authenticated delete photos" on storage.objects;

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
create policy "authenticated read photos" on storage.objects
  for select using (
    bucket_id in ('dog-photos', 'meal-photos')
    and auth.uid() is not null
  );

create policy "authenticated upload photos" on storage.objects
  for insert with check (
    bucket_id in ('dog-photos', 'meal-photos')
    and auth.uid() is not null
  );

create policy "authenticated update photos" on storage.objects
  for update using (
    bucket_id in ('dog-photos', 'meal-photos')
    and auth.uid() is not null
  );

create policy "authenticated delete photos" on storage.objects
  for delete using (
    bucket_id in ('dog-photos', 'meal-photos')
    and auth.uid() is not null
  );

-- ==============================================================================
-- PART 7: Reload PostgREST schema cache
-- ==============================================================================
notify pgrst, 'reload schema';
