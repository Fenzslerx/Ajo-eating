-- 1. Create or replace create_dog RPC function
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

  -- Insert into dogs table
  insert into public.dogs (name, photo, owner_id)
  values (trim(dog_name), dog_photo, auth.uid())
  returning * into new_dog;

  -- Ensure membership with owner role
  insert into public.dog_members (dog_id, user_id, role)
  values (new_dog.id, auth.uid(), 'owner')
  on conflict (dog_id, user_id) do update set role = 'owner';

  return new_dog;
end;
$$;

revoke all on function public.create_dog(text, text) from public;
grant execute on function public.create_dog(text, text) to authenticated, anon;

-- Force PostgREST schema cache reload immediately
notify pgrst, 'reload schema';

-- 2. Drop direct client INSERT policy on dogs
drop policy if exists "users can create owned dogs" on public.dogs;

-- Ensure SELECT on dogs allows members and direct owners
drop policy if exists "members can view dogs" on public.dogs;
drop policy if exists "members and owners can view dogs" on public.dogs;
create policy "members and owners can view dogs" on public.dogs
  for select using (owner_id = auth.uid() or public.is_dog_member(id));

-- Ensure UPDATE / DELETE remain owner only
drop policy if exists "owners can update dogs" on public.dogs;
create policy "owners can update dogs" on public.dogs
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "owners can delete dogs" on public.dogs;
create policy "owners can delete dogs" on public.dogs
  for delete using (owner_id = auth.uid());

-- 3. Simplify dog_members policies
drop policy if exists "members can view members" on public.dog_members;
create policy "members can view members" on public.dog_members
  for select using (public.is_dog_member(dog_id));

drop policy if exists "owners manage members" on public.dog_members;
create policy "owners manage members" on public.dog_members
  for all using (
    exists (select 1 from public.dogs where id = dog_id and owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.dogs where id = dog_id and owner_id = auth.uid())
  );
