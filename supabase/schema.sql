create extension if not exists "pgcrypto";

create table if not exists public.tutors (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  name text not null,
  language_learned text not null default '',
  level text not null default '',
  goals text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  title text not null,
  lesson_date date not null default current_date,
  objective text not null default '',
  topic text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  name text not null,
  "order" integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists students_tutor_id_idx on public.students(tutor_id);
create index if not exists lessons_tutor_id_idx on public.lessons(tutor_id);
create index if not exists lessons_student_id_idx on public.lessons(student_id);
create index if not exists boards_lesson_id_idx on public.boards(lesson_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tutors_set_updated_at on public.tutors;
create trigger tutors_set_updated_at
before update on public.tutors
for each row execute function public.set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
before update on public.boards
for each row execute function public.set_updated_at();

create or replace function public.handle_new_tutor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tutors (id, email, first_name, last_name, timezone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC')
  )
  on conflict (id) do update set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    timezone = excluded.timezone;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_tutor();

alter table public.tutors enable row level security;
alter table public.students enable row level security;
alter table public.lessons enable row level security;
alter table public.boards enable row level security;

drop policy if exists "Tutors can read own profile" on public.tutors;
create policy "Tutors can read own profile"
on public.tutors for select
using (auth.uid() = id);

drop policy if exists "Tutors can update own profile" on public.tutors;
create policy "Tutors can update own profile"
on public.tutors for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Tutors can insert own profile" on public.tutors;
create policy "Tutors can insert own profile"
on public.tutors for insert
with check (auth.uid() = id);

drop policy if exists "Tutors manage own students" on public.students;
create policy "Tutors manage own students"
on public.students for all
using (auth.uid() = tutor_id)
with check (auth.uid() = tutor_id);

drop policy if exists "Tutors manage own lessons" on public.lessons;
create policy "Tutors manage own lessons"
on public.lessons for all
using (auth.uid() = tutor_id)
with check (
  auth.uid() = tutor_id
  and (
    student_id is null
    or exists (
      select 1 from public.students
      where students.id = lessons.student_id
        and students.tutor_id = auth.uid()
    )
  )
);

drop policy if exists "Tutors manage boards through lessons" on public.boards;
create policy "Tutors manage boards through lessons"
on public.boards for all
using (
  exists (
    select 1 from public.lessons
    where lessons.id = boards.lesson_id
      and lessons.tutor_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.lessons
    where lessons.id = boards.lesson_id
      and lessons.tutor_id = auth.uid()
  )
);
