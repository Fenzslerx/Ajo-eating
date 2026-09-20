create or replace function public.get_dog_members(target_dog_id uuid)
returns table (user_id uuid, email text, role public.member_role)
language sql stable security definer set search_path = public, auth as $$
  select dm.user_id, u.email::text, dm.role
  from public.dog_members dm
  join auth.users u on u.id = dm.user_id
  where dm.dog_id = target_dog_id
    and public.is_dog_member(target_dog_id)
  order by dm.role, u.email;
$$;

create or replace function public.invite_dog_member(target_dog_id uuid, member_email text)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare invited_user_id uuid;
begin
  if not exists (select 1 from public.dogs where id = target_dog_id and owner_id = auth.uid()) then
    raise exception 'only an owner can invite members';
  end if;
  select id into invited_user_id from auth.users where lower(email) = lower(trim(member_email));
  if invited_user_id is null then
    raise exception 'user must sign up before they can be invited';
  end if;
  insert into public.dog_members (dog_id, user_id, role)
  values (target_dog_id, invited_user_id, 'member')
  on conflict (dog_id, user_id) do nothing;
end;
$$;

revoke all on function public.get_dog_members(uuid) from public;
revoke all on function public.invite_dog_member(uuid, text) from public;
grant execute on function public.get_dog_members(uuid) to authenticated;
grant execute on function public.invite_dog_member(uuid, text) to authenticated;
