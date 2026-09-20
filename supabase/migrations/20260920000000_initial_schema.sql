create extension if not exists "pgcrypto";

do $$ begin
  create type public.log_status as enum ('finished', 'partial', 'none');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.member_role as enum ('owner', 'member');
exception when duplicate_object then null;
end $$;

create table if not exists public.dogs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  photo text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.dog_members (
  dog_id uuid not null references public.dogs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (dog_id, user_id)
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  time time not null,
  created_at timestamptz not null default now()
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  schedule_id uuid references public.schedules(id) on delete set null,
  at timestamptz not null default now(),
  status public.log_status not null,
  amount_g numeric(7,2) check (amount_g is null or amount_g >= 0),
  food text,
  note text,
  photo text,
  by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists schedules_dog_id_idx on public.schedules(dog_id);
create index if not exists logs_dog_at_idx on public.logs(dog_id, at desc);

create or replace function public.is_dog_member(target_dog_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dog_members where dog_id = target_dog_id and user_id = auth.uid());
$$;

create or replace function public.add_dog_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id <> auth.uid() then raise exception 'owner_id must be the current user'; end if;
  insert into public.dog_members (dog_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

drop trigger if exists dogs_add_owner on public.dogs;
create trigger dogs_add_owner after insert on public.dogs for each row execute function public.add_dog_owner();

alter table public.dogs enable row level security;
alter table public.dog_members enable row level security;
alter table public.schedules enable row level security;
alter table public.logs enable row level security;

drop policy if exists "members can view dogs" on public.dogs;
drop policy if exists "users can create owned dogs" on public.dogs;
drop policy if exists "owners can update dogs" on public.dogs;
drop policy if exists "owners can delete dogs" on public.dogs;
create policy "members can view dogs" on public.dogs for select using (public.is_dog_member(id));
create policy "users can create owned dogs" on public.dogs for insert with check (owner_id = auth.uid());
create policy "owners can update dogs" on public.dogs for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners can delete dogs" on public.dogs for delete using (owner_id = auth.uid());

drop policy if exists "members can view members" on public.dog_members;
drop policy if exists "owners manage members" on public.dog_members;
create policy "members can view members" on public.dog_members for select using (public.is_dog_member(dog_id));
create policy "owners manage members" on public.dog_members for all using (exists (select 1 from public.dogs where id = dog_id and owner_id = auth.uid())) with check (exists (select 1 from public.dogs where id = dog_id and owner_id = auth.uid()));

drop policy if exists "members manage schedules" on public.schedules;
drop policy if exists "members manage logs" on public.logs;
create policy "members manage schedules" on public.schedules for all using (public.is_dog_member(dog_id)) with check (public.is_dog_member(dog_id));
create policy "members manage logs" on public.logs for all using (public.is_dog_member(dog_id)) with check (public.is_dog_member(dog_id) and by = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.logs;
exception when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public) values ('dog-photos', 'dog-photos', false) on conflict (id) do nothing;
drop policy if exists "members read dog photos" on storage.objects;
drop policy if exists "members upload dog photos" on storage.objects;
drop policy if exists "members update dog photos" on storage.objects;
drop policy if exists "members delete dog photos" on storage.objects;
create policy "members read dog photos" on storage.objects for select using (bucket_id = 'dog-photos' and public.is_dog_member((storage.foldername(name))[1]::uuid));
create policy "members upload dog photos" on storage.objects for insert with check (bucket_id = 'dog-photos' and public.is_dog_member((storage.foldername(name))[1]::uuid));
create policy "members update dog photos" on storage.objects for update using (bucket_id = 'dog-photos' and public.is_dog_member((storage.foldername(name))[1]::uuid));
create policy "members delete dog photos" on storage.objects for delete using (bucket_id = 'dog-photos' and public.is_dog_member((storage.foldername(name))[1]::uuid));
