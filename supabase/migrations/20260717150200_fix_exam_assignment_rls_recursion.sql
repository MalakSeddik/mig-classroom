-- Fixes infinite recursion discovered during verification: the previous
-- migration's exam_assignments_select policy did a raw correlated
-- subquery directly against exam_assignment_students, and
-- exam_assignment_students' policies did the same back against
-- exam_assignments. Each table's RLS is enforced while evaluating the
-- other's policy, which re-triggers the first table's policy, forever -
-- the exact "a policy that queries a table which re-triggers the same
-- policy" trap is_admin()/teaches_class()/is_enrolled() were built as
-- SECURITY DEFINER functions to avoid (see "Access model (RLS)" in
-- CLAUDE.md). The raw subqueries here just weren't wrapped the same way.
--
-- Fix: two new SECURITY DEFINER helpers, same pattern as the existing
-- ones - each bypasses RLS on the table it queries (it runs as the
-- function's owner, not the caller), so evaluating one table's policy no
-- longer re-enters the other table's RLS at all.

create function public.assignment_grants_student(assignment_id uuid, sid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.exam_assignment_students eas
    where eas.exam_assignment_id = assignment_id and eas.student_id = sid
  );
$$;

grant execute on function public.assignment_grants_student(uuid, uuid) to authenticated;

create function public.is_assignment_staff(assignment_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.exam_assignments ea
    where ea.id = assignment_id
      and (public.is_admin() or (ea.class_id is not null and public.teaches_class(ea.class_id)))
  );
$$;

grant execute on function public.is_assignment_staff(uuid) to authenticated;

-- Replace exam_assignments_select to use the helper instead of a raw
-- subquery against exam_assignment_students.
drop policy "exam_assignments_select" on public.exam_assignments;

create policy "exam_assignments_select" on public.exam_assignments
  for select to authenticated
  using (
    public.is_admin()
    or (class_id is not null and public.teaches_class(class_id))
    or assigned_by = auth.uid()
    or public.assignment_grants_student(id, auth.uid())
  );

-- Replace exam_assignment_students' policies to use the helper instead of
-- a raw subquery against exam_assignments.
drop policy "exam_assignment_students_staff_insert" on public.exam_assignment_students;
drop policy "exam_assignment_students_select" on public.exam_assignment_students;
drop policy "exam_assignment_students_staff_delete" on public.exam_assignment_students;

create policy "exam_assignment_students_staff_insert" on public.exam_assignment_students
  for insert to authenticated
  with check (public.is_assignment_staff(exam_assignment_id));

create policy "exam_assignment_students_select" on public.exam_assignment_students
  for select to authenticated
  using (student_id = auth.uid() or public.is_assignment_staff(exam_assignment_id));

create policy "exam_assignment_students_staff_delete" on public.exam_assignment_students
  for delete to authenticated
  using (public.is_assignment_staff(exam_assignment_id));
