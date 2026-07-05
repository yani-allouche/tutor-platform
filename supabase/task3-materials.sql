create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  filename text not null,
  file_type text not null,
  file_size bigint not null,
  storage_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uploaded_files_lesson_id_idx on public.uploaded_files(lesson_id);
create index if not exists uploaded_files_board_id_idx on public.uploaded_files(board_id);

alter table public.uploaded_files enable row level security;

drop trigger if exists uploaded_files_set_updated_at on public.uploaded_files;
create trigger uploaded_files_set_updated_at
before update on public.uploaded_files
for each row execute function public.set_updated_at();

alter table public.whiteboard_objects
drop constraint if exists whiteboard_objects_type_check;

alter table public.whiteboard_objects
add column if not exists parent_material_id uuid references public.whiteboard_objects(id) on delete cascade;

alter table public.whiteboard_objects
add column if not exists page_number integer;

alter table public.whiteboard_objects
add constraint whiteboard_objects_type_check
check (type in ('text', 'pencil_stroke', 'highlighter_stroke', 'shape', 'arrow', 'image', 'pdf', 'pdf_annotation'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-materials',
  'lesson-materials',
  false,
  52428800,
  array['application/pdf', 'image/png', 'image/jpeg']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Tutors manage uploaded files through lessons" on public.uploaded_files;
create policy "Tutors manage uploaded files through lessons"
on public.uploaded_files for all
using (
  exists (
    select 1
    from public.lessons
    where lessons.id = uploaded_files.lesson_id
      and lessons.tutor_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lessons
    where lessons.id = uploaded_files.lesson_id
      and lessons.tutor_id = auth.uid()
  )
);

drop policy if exists "Tutors manage own lesson materials" on storage.objects;
create policy "Tutors manage own lesson materials"
on storage.objects for all
using (
  bucket_id = 'lesson-materials'
  and exists (
    select 1
    from public.lessons
    where lessons.id::text = (storage.foldername(name))[1]
      and lessons.tutor_id = auth.uid()
  )
)
with check (
  bucket_id = 'lesson-materials'
  and exists (
    select 1
    from public.lessons
    where lessons.id::text = (storage.foldername(name))[1]
      and lessons.tutor_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
