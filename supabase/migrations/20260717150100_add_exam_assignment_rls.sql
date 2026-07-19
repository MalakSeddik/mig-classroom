-- Step 5 part 2, Phase B: RLS for exam_assignments/exam_assignment_students,
-- plus additive student read access on exams/exam_attempts/answers.
--
-- Deliberately NOT touched: question_bank and exam_questions RLS stays
-- exactly as Step 5 part 1 left it - fully staff-only, zero grant to
-- students. That's what makes "correct_answer never reaches the browser"
-- airtight by construction (Postgres RLS is row-level, not column-level,
-- so there's no clean way to expose "prompt but not correct_answer" via a
-- table policy). All student-facing question content instead goes
-- through vetted server-side functions using the admin (service_role)
-- client, which explicitly build a response that omits correct_answer -
-- see apps/web/src/lib/exams/attempt-engine.ts.
--
-- Also deliberately NOT touched: exam_attempts/answers get a new SELECT
-- policy for students below, but no INSERT/UPDATE policy at all. Every
-- write (starting an attempt, saving an answer, submitting, grading)
-- goes through those same admin-client server functions, never a raw RLS
-- grant - this closes off a student crafting a direct REST call to
-- insert a fake attempt or backdate started_at.

create function public.is_exam_assigned(eid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.exam_assignment_students eas
    join public.exam_assignments ea on ea.id = eas.exam_assignment_id
    where ea.exam_id = eid and eas.student_id = auth.uid()
  );
$$;

grant execute on function public.is_exam_assigned(uuid) to authenticated;

-- ============================================================
-- exam_assignments
-- ============================================================
-- Insert/update/delete: admin, or the teacher of the target class (only
-- meaningful when class_id is set - the admin-only student-list flow
-- always leaves class_id null, so only is_admin() can write those).
create policy "exam_assignments_staff_insert" on public.exam_assignments
  for insert to authenticated
  with check (
    public.is_admin()
    or (class_id is not null and public.teaches_class(class_id))
  );

create policy "exam_assignments_select" on public.exam_assignments
  for select to authenticated
  using (
    public.is_admin()
    or (class_id is not null and public.teaches_class(class_id))
    or assigned_by = auth.uid()
    or exists (
      select 1 from public.exam_assignment_students eas
      where eas.exam_assignment_id = exam_assignments.id
        and eas.student_id = auth.uid()
    )
  );

create policy "exam_assignments_staff_update" on public.exam_assignments
  for update to authenticated
  using (public.is_admin() or (class_id is not null and public.teaches_class(class_id)))
  with check (public.is_admin() or (class_id is not null and public.teaches_class(class_id)));

create policy "exam_assignments_staff_delete" on public.exam_assignments
  for delete to authenticated
  using (public.is_admin() or (class_id is not null and public.teaches_class(class_id)));

-- ============================================================
-- exam_assignment_students
-- ============================================================
create policy "exam_assignment_students_staff_insert" on public.exam_assignment_students
  for insert to authenticated
  with check (
    exists (
      select 1 from public.exam_assignments ea
      where ea.id = exam_assignment_id
        and (public.is_admin() or (ea.class_id is not null and public.teaches_class(ea.class_id)))
    )
  );

create policy "exam_assignment_students_select" on public.exam_assignment_students
  for select to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.exam_assignments ea
      where ea.id = exam_assignment_id
        and (public.is_admin() or (ea.class_id is not null and public.teaches_class(ea.class_id)))
    )
  );

create policy "exam_assignment_students_staff_delete" on public.exam_assignment_students
  for delete to authenticated
  using (
    exists (
      select 1 from public.exam_assignments ea
      where ea.id = exam_assignment_id
        and (public.is_admin() or (ea.class_id is not null and public.teaches_class(ea.class_id)))
    )
  );

-- ============================================================
-- exams: additive student read access, scoped to assigned exams only
-- ============================================================
create policy "exams_student_assigned_select" on public.exams
  for select to authenticated
  using (public.is_exam_assigned(id));

-- ============================================================
-- exam_attempts / answers: additive, student read-only, own rows only
-- ============================================================
create policy "exam_attempts_student_select" on public.exam_attempts
  for select to authenticated
  using (student_id = auth.uid());

create policy "answers_student_select" on public.answers
  for select to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id = answers.attempt_id and a.student_id = auth.uid()
    )
  );
