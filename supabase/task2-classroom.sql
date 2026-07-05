create table if not exists public.whiteboard_objects (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  type text not null check (type in ('text', 'pencil_stroke', 'highlighter_stroke', 'shape', 'arrow')),
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 0,
  height double precision not null default 0,
  rotation double precision not null default 0,
  z_index integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whiteboard_objects_board_id_idx on public.whiteboard_objects(board_id);

drop trigger if exists whiteboard_objects_set_updated_at on public.whiteboard_objects;
create trigger whiteboard_objects_set_updated_at
before update on public.whiteboard_objects
for each row execute function public.set_updated_at();

alter table public.whiteboard_objects enable row level security;

drop policy if exists "Tutors manage whiteboard objects through boards" on public.whiteboard_objects;
create policy "Tutors manage whiteboard objects through boards"
on public.whiteboard_objects for all
using (
  exists (
    select 1
    from public.boards
    join public.lessons on lessons.id = boards.lesson_id
    where boards.id = whiteboard_objects.board_id
      and lessons.tutor_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.boards
    join public.lessons on lessons.id = boards.lesson_id
    where boards.id = whiteboard_objects.board_id
      and lessons.tutor_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
