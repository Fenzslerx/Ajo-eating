-- 1. Migrate dog_members role column to text check ('owner', 'caretaker', 'viewer')
alter table public.dog_members alter column role drop default;
alter table public.dog_members alter column role type text using role::text;

update public.dog_members
set role = 'caretaker'
where role not in ('owner', 'caretaker', 'viewer');

alter table public.dog_members
  drop constraint if exists dog_members_role_check;

alter table public.dog_members
  add constraint dog_members_role_check check (role in ('owner', 'caretaker', 'viewer'));

alter table public.dog_members
  alter column role set default 'caretaker';

-- 2. Create dog_invites table
create table if not exists public.dog_invites (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid references public.dogs(id) on delete cascade not null,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  role text not null check (role in ('caretaker', 'viewer')),
  created_by uuid references auth.users(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dog_invites_dog_idx on public.dog_invites(dog_id, status);
create index if not exists dog_invites_token_idx on public.dog_invites(token);

alter table public.dog_invites enable row level security;

drop policy if exists "owners view invites" on public.dog_invites;
create policy "owners view invites" on public.dog_invites
  for select using (
    exists (
      select 1 from public.dog_members
      where dog_id = dog_invites.dog_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

-- 3. Permission helper functions
create or replace function public.is_dog_owner(target_dog_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dog_members
    where dog_id = target_dog_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function public.can_edit_dog(target_dog_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dog_members
    where dog_id = target_dog_id
      and user_id = auth.uid()
      and role in ('owner', 'caretaker')
  );
$$;

-- 4. RPC Functions (Security Definer)

-- A. create_invite_link
create or replace function public.create_invite_link(dog_id_input uuid, role_input text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  generated_token text;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนสร้างลิงก์เชิญ';
  end if;

  if not public.is_dog_owner(dog_id_input) then
    raise exception 'เฉพาะเจ้าของน้องหมา (Owner) เท่านั้นที่สามารถสร้างลิงก์เชิญได้';
  end if;

  if role_input not in ('caretaker', 'viewer') then
    raise exception 'สิทธิ์ที่ระบุต้องเป็น caretaker หรือ viewer เท่านั้น';
  end if;

  insert into public.dog_invites (dog_id, role, created_by)
  values (dog_id_input, role_input, auth.uid())
  returning token into generated_token;

  return generated_token;
end;
$$;

-- B. accept_invite
create or replace function public.accept_invite(token_input text)
returns public.dogs
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_invite public.dog_invites%rowtype;
  joined_dog public.dogs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนรับคำเชิญ';
  end if;

  select * into target_invite
  from public.dog_invites
  where token = token_input;

  if target_invite.id is null then
    raise exception 'ไม่พบลิงก์คำเชิญนี้ในระบบ';
  end if;

  if target_invite.status = 'accepted' then
    raise exception 'ลิงก์คำเชิญนี้ถูกใช้งานไปแล้ว';
  end if;

  if target_invite.status = 'revoked' then
    raise exception 'ลิงก์คำเชิญนี้ถูกยกเลิกแล้ว';
  end if;

  if target_invite.expires_at <= now() or target_invite.status = 'expired' then
    raise exception 'ลิงก์คำเชิญนี้หมดอายุแล้ว';
  end if;

  select * into joined_dog
  from public.dogs
  where id = target_invite.dog_id;

  if joined_dog.id is null then
    raise exception 'ไม่พบข้อมูลน้องหมาของคำเชิญนี้';
  end if;

  -- Add member or update role if already member (without downgrading an existing owner)
  insert into public.dog_members (dog_id, user_id, role)
  values (target_invite.dog_id, auth.uid(), target_invite.role)
  on conflict (dog_id, user_id) do update
    set role = case when dog_members.role = 'owner' then 'owner' else excluded.role end;

  -- Mark invite as accepted
  update public.dog_invites
  set status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now()
  where id = target_invite.id;

  return joined_dog;
end;
$$;

-- C. revoke_invite
create or replace function public.revoke_invite(invite_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_dog_id uuid;
begin
  select dog_id into target_dog_id
  from public.dog_invites
  where id = invite_id_input;

  if target_dog_id is null then
    raise exception 'ไม่พบข้อมูลคำเชิญ';
  end if;

  if not public.is_dog_owner(target_dog_id) then
    raise exception 'เฉพาะเจ้าของน้องหมาเท่านั้นที่สามารถยกเลิกคำเชิญได้';
  end if;

  update public.dog_invites
  set status = 'revoked'
  where id = invite_id_input;
end;
$$;

-- D. set_dog_member_role
create or replace function public.set_dog_member_role(target_dog_id uuid, target_user_id uuid, target_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_dog_owner(target_dog_id) then
    raise exception 'เฉพาะเจ้าของน้องหมาเท่านั้นที่สามารถเปลี่ยนสิทธิ์ได้';
  end if;

  if target_role not in ('caretaker', 'viewer') then
    raise exception 'สิทธิ์ต้องเป็น caretaker หรือ viewer เท่านั้น';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'ไม่สามารถเปลี่ยนสิทธิ์ของตนเองได้';
  end if;

  update public.dog_members
  set role = target_role
  where dog_id = target_dog_id
    and user_id = target_user_id
    and role <> 'owner';
end;
$$;

-- E. remove_dog_member
create or replace function public.remove_dog_member(target_dog_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_dog_owner(target_dog_id) then
    raise exception 'เฉพาะเจ้าของน้องหมาเท่านั้นที่สามารถลบสมาชิกได้';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'ไม่สามารถลบตนเองออกจากการเป็นเจ้าของได้';
  end if;

  delete from public.dog_members
  where dog_id = target_dog_id
    and user_id = target_user_id
    and role <> 'owner';
end;
$$;

-- F. get_dog_members (includes join date-- 3.6 ดึงรายชื่อสมาชิกพร้อมอีเมล
drop function if exists public.get_dog_members(uuid);
create or replace function public.get_dog_members(target_dog_id uuid)
returns table (
  id uuid,
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
    dm.id,
    dm.dog_id,
    dm.user_id,
    dm.role,
    dm.created_at,
    u.email::text
  from public.dog_members dm
  left join auth.users u on u.id = dm.user_id
  where dm.dog_id = target_dog_id
    and exists (
      select 1 from public.dog_members check_m
      where check_m.dog_id = target_dog_id and check_m.user_id = auth.uid()
    )
  order by (case dm.role when 'owner' then 1 when 'caretaker' then 2 else 3 end), dm.created_at asc;
$$;

-- 3.7 ดึงรายการคำเชิญของน้องหมา
drop function if exists public.get_dog_invites(uuid);
create or replace function public.get_dog_invites(target_dog_id uuid)
returns table (
  id uuid,
  token text,
  role text,
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select id, token, role, status, expires_at, created_at
  from public.dog_invites
  where dog_id = target_dog_id
    and public.is_dog_owner(target_dog_id)
    and status = 'pending'
    and expires_at > now()
  order by created_at desc;
$$;

-- Grants
grant execute on function public.create_invite_link(uuid, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.set_dog_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_dog_member(uuid, uuid) to authenticated;
grant execute on function public.get_dog_members(uuid) to authenticated;
grant execute on function public.get_dog_invites(uuid) to authenticated;

-- 5. RLS Policies for schedules and logs
drop policy if exists "members manage schedules" on public.schedules;
drop policy if exists "editors manage schedules" on public.schedules;
drop policy if exists "members view schedules" on public.schedules;

create policy "members view schedules" on public.schedules
  for select using (public.is_dog_member(dog_id));

create policy "editors and owners manage schedules" on public.schedules
  for all using (public.can_edit_dog(dog_id)) with check (public.can_edit_dog(dog_id));

drop policy if exists "members manage logs" on public.logs;
drop policy if exists "members view logs" on public.logs;
drop policy if exists "editors add logs" on public.logs;
drop policy if exists "authors edit logs" on public.logs;
drop policy if exists "authors delete logs" on public.logs;

create policy "members view logs" on public.logs
  for select using (public.is_dog_member(dog_id));

create policy "caretakers and owners add logs" on public.logs
  for insert with check (public.can_edit_dog(dog_id) and by = auth.uid());

create policy "caretakers and owners edit logs" on public.logs
  for update using (public.can_edit_dog(dog_id)) with check (public.can_edit_dog(dog_id));

create policy "caretakers and owners delete logs" on public.logs
  for delete using (public.can_edit_dog(dog_id));

-- Reload schema cache
notify pgrst, 'reload schema';
