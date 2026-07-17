-- Row-Level Security policies for MIG Classroom.
--
-- RLS was already enabled on every table in the initial schema migration,
-- with zero policies (fully locked down). This migration adds the actual
-- access rules.

-- ============================================================
-- Helper functions
-- ============================================================
-- All SECURITY DEFINER: their internal queries bypass RLS, which is what
-- avoids infinite recursion when a policy on `profiles` needs to check
-- the caller's own role by querying `profiles`. `set search_path = public`
-- is a standard hardening step for SECURITY DEFINER functions (pins name
-- resolution so they can't be tricked by a caller's search_path).
-- `stable` tells Postgres the result won't change within one statement,
-- which helps the query planner.

create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create function public.is_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

-- "Teaches" is defined as classes.teacher_id = the caller - the same
-- definition used directly (inline) within classes' own policies.
create function public.teaches_class(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.classes
    where id = cid and teacher_id = auth.uid()
  );
$$;

create function public.is_enrolled(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.enrollments
    where class_id = cid and student_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.teaches_class(uuid) to authenticated;
grant execute on function public.is_enrolled(uuid) to authenticated;

-- ============================================================
-- profiles
-- ============================================================

-- A row is visible to: its own owner, any admin, or a teacher who has
-- the owning student enrolled in one of that teacher's classes. This
-- last branch checks classes.teacher_id directly rather than via a role
-- check - "teaches" is defined by being assigned as a class's teacher,
-- the same definition teaches_class() uses.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = profiles.id
        and c.teacher_id = auth.uid()
    )
  );

-- Everyone can update their own row (further restricted below by a
-- trigger that blocks changing `role` unless is_admin()). Admins can
-- update any row - the only way a role is meant to change post-signup.
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert/delete policy on profiles at all - the only way a row gets
-- created is the SECURITY DEFINER trigger from Step 3 part 1, which
-- bypasses RLS. Regular users can never insert directly.

-- Column-level protection for `role`, independent of the policies above:
-- even though "own row" updates are allowed, this trigger blocks the
-- specific case of the role column changing unless the caller is an
-- admin. This is the actual enforcement of "role can never be
-- self-changed" - the RLS policies alone only gate which rows/columns
-- can be touched, not which specific column values change.
create function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change a profile role';
  end if;
  return new;
end;
$$;

create trigger protect_profile_role_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ============================================================
-- courses
-- ============================================================

create policy "courses_select_authenticated" on public.courses
  for select to authenticated
  using (true);

create policy "courses_insert_admin" on public.courses
  for insert to authenticated
  with check (public.is_admin());

create policy "courses_update_admin" on public.courses
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "courses_delete_admin" on public.courses
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- classes
-- ============================================================

create policy "classes_select" on public.classes
  for select to authenticated
  using (
    public.is_admin()
    or teacher_id = auth.uid()
    or public.is_enrolled(id)
  );

create policy "classes_insert_admin" on public.classes
  for insert to authenticated
  with check (public.is_admin());

create policy "classes_update" on public.classes
  for update to authenticated
  using (public.is_admin() or teacher_id = auth.uid())
  with check (public.is_admin() or teacher_id = auth.uid());

create policy "classes_delete_admin" on public.classes
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- enrollments
-- ============================================================

create policy "enrollments_select" on public.enrollments
  for select to authenticated
  using (
    public.is_admin()
    or public.teaches_class(class_id)
    or student_id = auth.uid()
  );

create policy "enrollments_insert" on public.enrollments
  for insert to authenticated
  with check (public.is_admin() or public.teaches_class(class_id));

create policy "enrollments_update" on public.enrollments
  for update to authenticated
  using (public.is_admin() or public.teaches_class(class_id))
  with check (public.is_admin() or public.teaches_class(class_id));

create policy "enrollments_delete" on public.enrollments
  for delete to authenticated
  using (public.is_admin() or public.teaches_class(class_id));

-- ============================================================
-- assignments
-- ============================================================

create policy "assignments_select" on public.assignments
  for select to authenticated
  using (
    public.is_admin()
    or public.teaches_class(class_id)
    or public.is_enrolled(class_id)
  );

create policy "assignments_insert" on public.assignments
  for insert to authenticated
  with check (public.is_admin() or public.teaches_class(class_id));

create policy "assignments_update" on public.assignments
  for update to authenticated
  using (public.is_admin() or public.teaches_class(class_id))
  with check (public.is_admin() or public.teaches_class(class_id));

create policy "assignments_delete" on public.assignments
  for delete to authenticated
  using (public.is_admin() or public.teaches_class(class_id));

-- ============================================================
-- submissions
-- ============================================================

create policy "submissions_select" on public.submissions
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id
        and public.teaches_class(a.class_id)
    )
  );

-- Only the owning student can create a submission, and only for an
-- assignment whose class they're actually enrolled in. Teachers/admins
-- never insert submissions - that would mean grading your own work.
create policy "submissions_insert_own" on public.submissions
  for insert to authenticated
  with check (
    not public.is_admin()
    and not public.is_teacher()
    and student_id = auth.uid()
    and exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id
        and public.is_enrolled(a.class_id)
    )
  );

-- Same rule for updates (e.g. editing a draft before the deadline).
-- Deliberately no teacher/admin update policy - that's what the
-- separate `grades` table is for, not editing the student's work.
create policy "submissions_update_own" on public.submissions
  for update to authenticated
  using (
    student_id = auth.uid()
    and not public.is_admin()
    and not public.is_teacher()
  )
  with check (
    student_id = auth.uid()
    and not public.is_admin()
    and not public.is_teacher()
    and exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id
        and public.is_enrolled(a.class_id)
    )
  );

-- No delete policy at all - nobody can delete a submission via the API.

-- ============================================================
-- grades
-- ============================================================
-- The critical one: students can read their own grade, but there is no
-- insert/update/delete policy granting them write access anywhere -
-- with RLS, no matching policy means denied by default. Only a teacher
-- of the relevant class, or an admin, can ever write a grade.

create policy "grades_select" on public.grades
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = grades.submission_id
        and s.student_id = auth.uid()
    )
    or exists (
      select 1
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = grades.submission_id
        and public.teaches_class(a.class_id)
    )
  );

create policy "grades_insert" on public.grades
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = grades.submission_id
        and public.teaches_class(a.class_id)
    )
  );

create policy "grades_update" on public.grades
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = grades.submission_id
        and public.teaches_class(a.class_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = grades.submission_id
        and public.teaches_class(a.class_id)
    )
  );

create policy "grades_delete" on public.grades
  for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = grades.submission_id
        and public.teaches_class(a.class_id)
    )
  );

-- ============================================================
-- class_sessions
-- ============================================================

create policy "class_sessions_select" on public.class_sessions
  for select to authenticated
  using (
    public.is_admin()
    or public.teaches_class(class_id)
    or public.is_enrolled(class_id)
  );

create policy "class_sessions_insert" on public.class_sessions
  for insert to authenticated
  with check (public.is_admin() or public.teaches_class(class_id));

create policy "class_sessions_update" on public.class_sessions
  for update to authenticated
  using (public.is_admin() or public.teaches_class(class_id))
  with check (public.is_admin() or public.teaches_class(class_id));

create policy "class_sessions_delete" on public.class_sessions
  for delete to authenticated
  using (public.is_admin() or public.teaches_class(class_id));

-- ============================================================
-- attendance
-- ============================================================
-- Students can see their own attendance but never write it - only a
-- policy for SELECT exists for them; insert/update/delete only match
-- the teacher/admin condition.

create policy "attendance_select" on public.attendance
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.class_sessions cs
      where cs.id = attendance.session_id
        and public.teaches_class(cs.class_id)
    )
  );

create policy "attendance_insert" on public.attendance
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.class_sessions cs
      where cs.id = attendance.session_id
        and public.teaches_class(cs.class_id)
    )
  );

create policy "attendance_update" on public.attendance
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.class_sessions cs
      where cs.id = attendance.session_id
        and public.teaches_class(cs.class_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.class_sessions cs
      where cs.id = attendance.session_id
        and public.teaches_class(cs.class_id)
    )
  );

create policy "attendance_delete" on public.attendance
  for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.class_sessions cs
      where cs.id = attendance.session_id
        and public.teaches_class(cs.class_id)
    )
  );

-- ============================================================
-- Exams (staff-only for now)
-- ============================================================
-- question_bank, exams, exam_questions, exam_attempts, answers: teachers
-- and admins only, for every operation. Students get zero access -
-- student-facing exam access (taking an exam, seeing their own attempt/
-- answers) is intentionally deferred to a later step, since it needs
-- careful design (e.g. a student must see the exam questions but never
-- `correct_answer`, and only their own attempt/answers). `for all`
-- applies the same rule to select/insert/update/delete at once, since
-- these tables don't need different rules per operation.

create policy "question_bank_staff_all" on public.question_bank
  for all to authenticated
  using (public.is_admin() or public.is_teacher())
  with check (public.is_admin() or public.is_teacher());

create policy "exams_staff_all" on public.exams
  for all to authenticated
  using (public.is_admin() or public.is_teacher())
  with check (public.is_admin() or public.is_teacher());

create policy "exam_questions_staff_all" on public.exam_questions
  for all to authenticated
  using (public.is_admin() or public.is_teacher())
  with check (public.is_admin() or public.is_teacher());

create policy "exam_attempts_staff_all" on public.exam_attempts
  for all to authenticated
  using (public.is_admin() or public.is_teacher())
  with check (public.is_admin() or public.is_teacher());

create policy "answers_staff_all" on public.answers
  for all to authenticated
  using (public.is_admin() or public.is_teacher())
  with check (public.is_admin() or public.is_teacher());
