do $$ begin alter type public.member_role add value 'editor'; exception when duplicate_object then null; end $$;
do $$ begin alter type public.member_role add value 'viewer'; exception when duplicate_object then null; end $$;

create or replace function public.is_dog_editor(target_dog_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dog_members
    where dog_id = target_dog_id and user_id = auth.uid()
      and role in ('owner', 'member', 'editor')
  );
$$;

drop policy if exists "members manage schedules" on public.schedules;
create policy "members view schedules" on public.schedules for select using (public.is_dog_member(dog_id));
create policy "editors manage schedules" on public.schedules for all using (public.is_dog_editor(dog_id)) with check (public.is_dog_editor(dog_id));

drop policy if exists "members manage logs" on public.logs;
create policy "members view logs" on public.logs for select using (public.is_dog_member(dog_id));
create policy "editors add logs" on public.logs for insert with check (public.is_dog_editor(dog_id) and by = auth.uid());
create policy "authors edit logs" on public.logs for update using (public.is_dog_editor(dog_id) and by = auth.uid()) with check (public.is_dog_editor(dog_id) and by = auth.uid());
create policy "authors delete logs" on public.logs for delete using (public.is_dog_editor(dog_id) and by = auth.uid());

create or replace function public.set_dog_member_role(target_dog_id uuid, target_user_id uuid, target_role public.member_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.dogs where id = target_dog_id and owner_id = auth.uid()) then raise exception 'only an owner can change roles'; end if;
  if target_role = 'owner' then raise exception 'owner role cannot be assigned'; end if;
  update public.dog_members set role = target_role where dog_id = target_dog_id and user_id = target_user_id and role <> 'owner';
end;
$$;
grant execute on function public.set_dog_member_role(uuid, uuid, public.member_role) to authenticated;
