-- Step 4 part 2: schema changes for file handling.

-- submissions.file_url was added in the initial schema but never wired
-- up. Renaming to file_path since what we actually store is a private
-- Storage object path (e.g. "{class_id}/{assignment_id}/{student_id}/
-- essay.pdf"), never a public URL - file_url would be a misleading name
-- for that. file_name keeps the student's original filename for display
-- (the storage path's filename may differ, though for submissions it
-- currently doesn't need to).
alter table public.submissions rename column file_url to file_path;
alter table public.submissions add column file_name text;

-- One assignment can have many teacher-attached material files.
create table public.assignment_materials (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  file_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index assignment_materials_assignment_id_idx on public.assignment_materials (assignment_id);

alter table public.assignment_materials enable row level security;

-- Same three-way pattern used throughout the schema: admin / teacher of
-- the assignment's class / enrolled student for read, admin / teacher
-- for write. No update policy - materials are uploaded or removed, not
-- edited in place.
create policy "assignment_materials_select" on public.assignment_materials
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_materials.assignment_id
        and (public.teaches_class(a.class_id) or public.is_enrolled(a.class_id))
    )
  );

create policy "assignment_materials_insert" on public.assignment_materials
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_materials.assignment_id
        and public.teaches_class(a.class_id)
    )
  );

create policy "assignment_materials_delete" on public.assignment_materials
  for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_materials.assignment_id
        and public.teaches_class(a.class_id)
    )
  );
