-- StudyMate — migration awal. Mengikuti SRS & ERD v1.0 (13 tabel, UUID PK, TIMESTAMPTZ, RLS).
-- Penambahan di luar kolom ERD hanya berupa CONSTRAINT / TRIGGER / INDEX (lihat docs/TRACEABILITY.md).

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- 1. profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name varchar(100) not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. user_settings
create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  theme varchar(20) not null default 'light' check (theme in ('light','dark')),
  language varchar(10) not null default 'id' check (language in ('id','en')),
  timezone varchar(60) not null default 'Asia/Jakarta',
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. subjects
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name varchar(150) not null,
  lecturer varchar(150),
  color varchar(20),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. schedules
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title varchar(200) not null,
  description text,
  category varchar(30) not null check (category in ('class','self_study','assignment','exam','personal')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  color varchar(20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_time_check check (end_at > start_at)
);

-- 5. class_schedules (0 = Minggu ... 6 = Sabtu)
create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  room varchar(100),
  lecturer varchar(150),
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_time_check check (end_time > start_time),
  constraint class_valid_check check (valid_until is null or valid_until >= valid_from)
);

-- 6. assignments
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title varchar(200) not null,
  description text,
  priority varchar(20) not null default 'medium' check (priority in ('high','medium','low')),
  status varchar(20) not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. study_folders
create table public.study_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  parent_folder_id uuid references public.study_folders(id) on delete cascade,
  name varchar(150) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. study_materials
create table public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  folder_id uuid references public.study_folders(id) on delete set null,
  file_name varchar(255) not null,
  storage_path text not null,
  file_type varchar(20) not null,
  mime_type varchar(150) not null,
  file_size bigint not null check (file_size > 0),
  processing_status varchar(20) not null default 'ready' check (processing_status in ('uploading','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. notes
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title varchar(200) not null,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. reminders (source_id polymorphic: divalidasi backend, dibersihkan trigger di bawah)
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type varchar(30) not null check (source_type in ('schedule','assignment','class_schedule')),
  source_id uuid not null,
  remind_at timestamptz not null,
  status varchar(20) not null default 'pending' check (status in ('pending','sent','cancelled','failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reminders_no_duplicate unique (source_type, source_id, remind_at)
);

-- 11. notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(200) not null,
  message text not null,
  type varchar(30) not null check (type in ('schedule_start','deadline_near','study_reminder','status_change')),
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 12. study_sessions
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  session_type varchar(20) not null check (session_type in ('focus','short_break','long_break')),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  status varchar(20) not null default 'running' check (status in ('running','paused','completed','cancelled')),
  created_at timestamptz not null default now()
);

-- 13. push_subscriptions
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform varchar(20) not null check (platform in ('web','android','ios','desktop')),
  endpoint text not null unique,
  subscription_data jsonb not null,
  device_name varchar(150),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- Index (SRS bagian 11)
create index on public.schedules (user_id, start_at);
create index on public.class_schedules (user_id, day_of_week);
create index on public.assignments (user_id, due_at);
create index on public.assignments (user_id, status);
create index on public.study_materials (user_id, created_at);
create index on public.study_materials (folder_id);
create index on public.notes (user_id, updated_at desc);
create index on public.reminders (status, remind_at);
create index on public.notifications (user_id, created_at desc);
create index on public.study_sessions (user_id, started_at);

-- updated_at otomatis
do $$ declare t text; begin
  foreach t in array array['profiles','user_settings','subjects','schedules','class_schedules','assignments','study_folders','study_materials','notes'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- FK lintas tabel harus menunjuk data milik user yang sama (SRS 10.3)
create or replace function public.enforce_same_owner() returns trigger language plpgsql as $$
declare ref_id uuid; owner uuid;
begin
  ref_id := nullif(to_jsonb(new) ->> tg_argv[1], '')::uuid;
  if ref_id is not null then
    execute format('select user_id from public.%I where id = $1', tg_argv[0]) into owner using ref_id;
    if owner is distinct from new.user_id then
      raise exception 'Data % yang direferensikan bukan milik pengguna ini', tg_argv[0] using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger own_subject before insert or update on public.schedules for each row execute function public.enforce_same_owner('subjects','subject_id');
create trigger own_subject before insert or update on public.class_schedules for each row execute function public.enforce_same_owner('subjects','subject_id');
create trigger own_subject before insert or update on public.assignments for each row execute function public.enforce_same_owner('subjects','subject_id');
create trigger own_subject before insert or update on public.study_folders for each row execute function public.enforce_same_owner('subjects','subject_id');
create trigger own_parent before insert or update on public.study_folders for each row execute function public.enforce_same_owner('study_folders','parent_folder_id');
create trigger own_subject before insert or update on public.study_materials for each row execute function public.enforce_same_owner('subjects','subject_id');
create trigger own_folder before insert or update on public.study_materials for each row execute function public.enforce_same_owner('study_folders','folder_id');
create trigger own_subject before insert or update on public.notes for each row execute function public.enforce_same_owner('subjects','subject_id');
create trigger own_assignment before insert or update on public.study_sessions for each row execute function public.enforce_same_owner('assignments','assignment_id');

-- Pengingat ikut dihapus bila sumbernya dihapus (REM-001)
create or replace function public.cleanup_reminders() returns trigger language plpgsql security definer set search_path = public as $$
begin delete from public.reminders where source_type = tg_argv[0] and source_id = old.id; return old; end $$;
create trigger rm_reminders after delete on public.schedules for each row execute function public.cleanup_reminders('schedule');
create trigger rm_reminders after delete on public.assignments for each row execute function public.cleanup_reminders('assignment');
create trigger rm_reminders after delete on public.class_schedules for each row execute function public.cleanup_reminders('class_schedule');

-- Profil dan pengaturan dibuat otomatis saat registrasi Supabase Auth
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)), 100));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Row Level Security (SRS 10.1)
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (auth.uid() = id);
create policy profiles_insert on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy profiles_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_delete on public.profiles for delete to authenticated using (auth.uid() = id);

do $$ declare t text; begin
  foreach t in array array['user_settings','subjects','schedules','class_schedules','assignments','study_folders','study_materials','notes','reminders','notifications','study_sessions','push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_owner', t);
  end loop;
end $$;

-- Storage privat (SRS 10.2): studymate-storage/{avatars|materials}/{user_id}/...
insert into storage.buckets (id, name, public) values ('studymate-storage', 'studymate-storage', false) on conflict (id) do nothing;
create policy sm_storage_select on storage.objects for select to authenticated using (bucket_id = 'studymate-storage' and (storage.foldername(name))[2] = auth.uid()::text);
create policy sm_storage_insert on storage.objects for insert to authenticated with check (bucket_id = 'studymate-storage' and (storage.foldername(name))[2] = auth.uid()::text);
create policy sm_storage_update on storage.objects for update to authenticated using (bucket_id = 'studymate-storage' and (storage.foldername(name))[2] = auth.uid()::text);
create policy sm_storage_delete on storage.objects for delete to authenticated using (bucket_id = 'studymate-storage' and (storage.foldername(name))[2] = auth.uid()::text);
