-- 1. Storage Buckets Setup
insert into storage.buckets (id, name, public)
values ('dog-photos', 'dog-photos', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do update set public = false;

-- Path helper for Storage RLS
create or replace function public.extract_dog_id_from_storage_path(path_text text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  folder_part text;
begin
  folder_part := split_part(path_text, '/', 1);
  if folder_part ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return folder_part::uuid;
  end if;
  folder_part := split_part(path_text, '/', 2);
  if folder_part ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return folder_part::uuid;
  end if;
  return null;
end;
$$;

-- Storage Policies for dog-photos and meal-photos
drop policy if exists "members read dog photos" on storage.objects;
drop policy if exists "members upload dog photos" on storage.objects;
drop policy if exists "members update dog photos" on storage.objects;
drop policy if exists "members delete dog photos" on storage.objects;

drop policy if exists "members read meal photos" on storage.objects;
drop policy if exists "members upload meal photos" on storage.objects;
drop policy if exists "members update meal photos" on storage.objects;
drop policy if exists "members delete meal photos" on storage.objects;

create policy "members read dog photos" on storage.objects
  for select using (
    bucket_id in ('dog-photos', 'meal-photos')
    and (
      public.is_dog_member(public.extract_dog_id_from_storage_path(name))
      or public.extract_dog_id_from_storage_path(name) is null
    )
  );

create policy "members upload dog photos" on storage.objects
  for insert with check (
    bucket_id in ('dog-photos', 'meal-photos')
    and (
      public.is_dog_member(public.extract_dog_id_from_storage_path(name))
      or public.extract_dog_id_from_storage_path(name) is null
    )
  );

create policy "members update dog photos" on storage.objects
  for update using (
    bucket_id in ('dog-photos', 'meal-photos')
    and public.is_dog_member(public.extract_dog_id_from_storage_path(name))
  );

create policy "members delete dog photos" on storage.objects
  for delete using (
    bucket_id in ('dog-photos', 'meal-photos')
    and public.is_dog_member(public.extract_dog_id_from_storage_path(name))
  );

-- 2. Notifications Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_key text not null,
  schedule_id uuid references public.schedules(id) on delete set null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, is_read, created_at desc);

create unique index if not exists notifications_dedup_idx
  on public.notifications(dog_id, user_id, meal_key, ((created_at at time zone 'Asia/Bangkok')::date));

alter table public.notifications enable row level security;

drop policy if exists "users view own notifications" on public.notifications;
create policy "users view own notifications" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications" on public.notifications
  for delete using (user_id = auth.uid());

-- Realtime for notifications
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- 3. Postgres Function: check_missed_meals
create or replace function public.check_missed_meals()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_dog record;
  target_schedule record;
  target_member record;
  current_time_bkk time;
  current_date_bkk date;
  logged_count int;
  meal_identifier text;
  notification_text text;
begin
  current_time_bkk := (now() at time zone 'Asia/Bangkok')::time;
  current_date_bkk := (now() at time zone 'Asia/Bangkok')::date;

  -- Iterate through active dogs having schedules
  for target_dog in select id, name from public.dogs loop
    for target_schedule in
      select id, label, time
      from public.schedules
      where dog_id = target_dog.id
    loop
      -- Check if schedule time has passed by at least 15 minutes
      if current_time_bkk >= (target_schedule.time + interval '15 minutes') then
        -- Count logs recorded today for this dog & schedule
        select count(*) into logged_count
        from public.logs
        where dog_id = target_dog.id
          and (schedule_id = target_schedule.id or schedule_id is null)
          and (at at time zone 'Asia/Bangkok')::date = current_date_bkk
          and (
            (at at time zone 'Asia/Bangkok')::time between
              (target_schedule.time - interval '1 hour') and
              (target_schedule.time + interval '2 hours')
          );

        if logged_count = 0 then
          meal_identifier := coalesce(target_schedule.label, 'มื้ออาหาร');
          notification_text := 'เลยเวลา' || meal_identifier || 'ของ ' || target_dog.name || ' แล้ว แต่ยังไม่มีบันทึกมื้ออาหาร';

          -- Notify all members of this dog
          for target_member in
            select user_id from public.dog_members where dog_id = target_dog.id
          loop
            insert into public.notifications (dog_id, user_id, meal_key, schedule_id, message)
            values (target_dog.id, target_member.user_id, meal_identifier, target_schedule.id, notification_text)
            on conflict (dog_id, user_id, meal_key, ((created_at at time zone 'Asia/Bangkok')::date))
            do nothing;
          end loop;
        end if;
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.check_missed_meals() from public;
grant execute on function public.check_missed_meals() to authenticated, service_role;

-- 4. Enable pg_cron and schedule job if available
do $$
begin
  create extension if not exists "pg_cron";
  create extension if not exists "pg_net";

  -- Remove existing job if present
  if exists (select 1 from cron.job where jobname = 'check-missed-meals') then
    perform cron.unschedule('check-missed-meals');
  end if;

  -- Schedule every 15 minutes
  perform cron.schedule('check-missed-meals', '*/15 * * * *', 'select public.check_missed_meals();');
exception when others then
  -- Ignore if pg_cron is disabled on local environment
  raise notice 'pg_cron setup skipped or not supported in current environment: %', sqlerrm;
end $$;
