-- Step 7 part 3: self-registration with admin approval.
--
-- New model: every profile has an approval `status` (pending / approved /
-- rejected), default 'pending'. A signed-up-but-not-yet-approved user can
-- still log in (their own profile row stays readable - see profiles_select
-- below, deliberately never gated by is_approved()), but is blocked from
-- every other real table by RLS itself, not just hidden in the UI.
--
-- `requested_role` records what the user asked for at signup
-- (student/teacher) - purely informational, never a privilege grant by
-- itself. The actual `role` column keeps hardcoding 'student' at signup
-- time exactly as before; only an admin, via the approval action, ever
-- sets a real role.

create type public.profile_status as enum ('pending', 'approved', 'rejected');

alter table public.profiles
  add column status public.profile_status not null default 'pending';

-- Backfill: every profile that existed before this feature shipped was
-- created under the old "no approval gate" model and has already been
-- using the app normally - treat all of them as already approved, so
-- this migration doesn't retroactively lock anyone out (including
-- whichever account is the existing admin) the instant it's applied.
-- Only genuinely new signups (via the trigger update below) ever start
-- out 'pending'. This UPDATE must run before is_admin()/is_teacher()
-- below start requiring status = 'approved', or the very next request
-- from the existing admin would be rejected by RLS.
update public.profiles set status = 'approved';

alter table public.profiles
  add column requested_role text
  check (requested_role is null or requested_role in ('student', 'teacher'));

-- ============================================================
-- is_approved() - the new choke-point helper, same SECURITY DEFINER
-- shape as is_admin()/is_teacher()
-- ============================================================

create function public.is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

grant execute on function public.is_approved() to authenticated;

-- ============================================================
-- Bake is_approved() into the four foundational helpers every other RLS
-- policy in this schema is already built from (see "Access model (RLS)"
-- in CLAUDE.md). This is what makes "pending/rejected blocked from all
-- real data" an emergent property of the existing architecture instead
-- of a rewrite of every policy in every migration - courses, classes,
-- enrollments, assignments, class_sessions, assignment_materials,
-- question_bank/exams/exam_questions/exam_attempts/answers (staff
-- access), and the submissions/materials/exam-media storage buckets all
-- flow through one of these four and inherit the gate automatically.
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

create or replace function public.is_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher' and status = 'approved'
  );
$$;

create or replace function public.teaches_class(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_approved() and exists (
    select 1 from public.classes
    where id = cid and teacher_id = auth.uid()
  );
$$;

create or replace function public.is_enrolled(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_approved() and exists (
    select 1 from public.enrollments
    where class_id = cid and student_id = auth.uid()
  );
$$;

-- Same treatment for the two exam-assignment helpers added in Step 5
-- part 2 - they don't route through the four above, so they'd otherwise
-- stay an ungated hole for a rejected former student's exam access.
create or replace function public.is_exam_assigned(eid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_approved() and exists (
    select 1
    from public.exam_assignment_students eas
    join public.exam_assignments ea on ea.id = eas.exam_assignment_id
    where ea.exam_id = eid and eas.student_id = auth.uid()
  );
$$;

create or replace function public.assignment_grants_student(assignment_id uuid, sid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_approved() and exists (
    select 1 from public.exam_assignment_students eas
    where eas.exam_assignment_id = assignment_id and eas.student_id = sid
  );
$$;

-- ============================================================
-- Bespoke "own row, matched directly on auth.uid(), no helper function
-- involved" policies - these don't route through any of the helpers
-- above, so each needs its own explicit is_approved() check. Every one
-- of these is a case where a signed-in user reads (or once, deletes)
-- their *own* data by direct id match rather than via an is_enrolled/
-- teaches_class lookup - the scenario this protects is a student who WAS
-- approved and has real data (submissions, grades, attendance, exam
-- attempts, recordings) but is later rejected: without this, they'd keep
-- seeing their own old data through these specific branches even though
-- every class/assignment-scoped view is now correctly locked out via the
-- helpers above.
-- ============================================================

-- profiles_select: the `id = auth.uid()` branch is deliberately left
-- untouched - a pending/rejected user must still be able to read their
-- own row to see their own status. Only the third branch (a teacher
-- viewing an enrolled student's profile, a raw join not routed through
-- teaches_class()) gets the extra check.
drop policy "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (
      public.is_approved()
      and exists (
        select 1
        from public.enrollments e
        join public.classes c on c.id = e.class_id
        where e.student_id = profiles.id
          and c.teacher_id = auth.uid()
      )
    )
  );

drop policy "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select to authenticated
  using (
    (public.is_approved() and student_id = auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id
        and public.teaches_class(a.class_id)
    )
  );

drop policy "grades_select" on public.grades;
create policy "grades_select" on public.grades
  for select to authenticated
  using (
    public.is_admin()
    or (
      public.is_approved()
      and exists (
        select 1 from public.submissions s
        where s.id = grades.submission_id
          and s.student_id = auth.uid()
      )
    )
    or exists (
      select 1
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = grades.submission_id
        and public.teaches_class(a.class_id)
    )
  );

drop policy "attendance_select" on public.attendance;
create policy "attendance_select" on public.attendance
  for select to authenticated
  using (
    (public.is_approved() and student_id = auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.class_sessions cs
      where cs.id = attendance.session_id
        and public.teaches_class(cs.class_id)
    )
  );

drop policy "exam_attempts_student_select" on public.exam_attempts;
create policy "exam_attempts_student_select" on public.exam_attempts
  for select to authenticated
  using (public.is_approved() and student_id = auth.uid());

drop policy "answers_student_select" on public.answers;
create policy "answers_student_select" on public.answers
  for select to authenticated
  using (
    public.is_approved()
    and exists (
      select 1 from public.exam_attempts a
      where a.id = answers.attempt_id and a.student_id = auth.uid()
    )
  );

drop policy "exam_assignment_students_select" on public.exam_assignment_students;
create policy "exam_assignment_students_select" on public.exam_assignment_students
  for select to authenticated
  using (
    (public.is_approved() and student_id = auth.uid())
    or public.is_assignment_staff(exam_assignment_id)
  );

drop policy "exam_assignments_select" on public.exam_assignments;
create policy "exam_assignments_select" on public.exam_assignments
  for select to authenticated
  using (
    public.is_admin()
    or (class_id is not null and public.teaches_class(class_id))
    or (public.is_approved() and assigned_by = auth.uid())
    or public.assignment_grants_student(id, auth.uid())
  );

-- speaking-answers bucket: the own-folder branches are a raw storage-path
-- check ((storage.foldername(name))[1] = auth.uid()::text), never routed
-- through any helper, so each needs the check added directly.
drop policy "speaking_answers_own_insert" on storage.objects;
create policy "speaking_answers_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'speaking-answers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved()
  );

drop policy "speaking_answers_own_update" on storage.objects;
create policy "speaking_answers_own_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'speaking-answers'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'speaking-answers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved()
  );

drop policy "speaking_answers_own_delete" on storage.objects;
create policy "speaking_answers_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'speaking-answers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved()
  );

drop policy "speaking_answers_select" on storage.objects;
create policy "speaking_answers_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'speaking-answers'
    and (
      ((storage.foldername(name))[1] = auth.uid()::text and public.is_approved())
      or public.is_admin()
    )
  );

-- submissions bucket: insert/update already transit is_enrolled() inside
-- their WITH CHECK (so they're already safe now that is_enrolled() is
-- gated above) - only delete (which has no WITH CHECK at all, just
-- USING) and the own-folder read branch of select were genuinely
-- ungated.
drop policy "submissions_bucket_delete_own" on storage.objects;
create policy "submissions_bucket_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[3] = auth.uid()::text
    and public.is_approved()
  );

drop policy "submissions_bucket_select" on storage.objects;
create policy "submissions_bucket_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (
      ((storage.foldername(name))[3] = auth.uid()::text and public.is_approved())
      or public.teaches_class((storage.foldername(name))[1]::uuid)
      or public.is_admin()
    )
  );

-- ============================================================
-- Signup trigger: also set status='pending' and capture requested_role
-- ============================================================
-- role stays hardcoded 'student' exactly as before - this is still the
-- only place a profile's role is ever set at creation time. requested_role
-- is read from signup metadata but validated against an allowlist of
-- exactly two values; anything else (missing, tampered, some other
-- string) silently falls back to 'student'. That validation is about
-- data hygiene, not a security boundary - requested_role never grants
-- anything by itself, so there's no privilege-escalation risk here even
-- if a client sent a bogus value.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text;
begin
  requested := new.raw_user_meta_data ->> 'requested_role';
  if requested is null or requested not in ('student', 'teacher') then
    requested := 'student';
  end if;

  insert into public.profiles (id, full_name, role, status, requested_role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'student', 'pending', requested);
  return new;
end;
$$;

-- ============================================================
-- Extend the existing role-protection trigger to also guard `status` -
-- same function, same bootstrap-exception shape (auth.uid() is null for
-- service_role/direct SQL, the only way to touch this table with no real
-- signed-in user behind it). Without this, profiles_update_own (which
-- lets anyone update their *own* row for columns other than role) would
-- let a pending user simply set their own status to 'approved' via a
-- direct REST call - the RLS policy allows the row, only this trigger
-- stops the column.
-- ============================================================

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only admins can change a profile role';
  end if;

  if new.status is distinct from old.status
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only admins can change a profile status';
  end if;

  return new;
end;
$$;
