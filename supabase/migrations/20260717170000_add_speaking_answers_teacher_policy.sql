-- Wiring <AudioRecorder> into exam speaking questions: adds the teacher
-- read policy on the speaking-answers bucket that
-- 20260717140000_add_speaking_answers_bucket_policies.sql deliberately
-- deferred, since "the relevant teacher" only became meaningful once a
-- recording is actually linked to an exam attempt (it is now, via
-- answers.response storing the storage path for type = 'speaking').
--
-- Scoped narrowly: only the teacher of the class the exam was assigned
-- through - never every teacher. A speaking-answers object's path is
-- {student_id}/{filename}, with no class segment to read directly (unlike
-- submissions/materials), so the lookup instead walks
-- answers -> exam_attempts -> exam_assignment_students -> exam_assignments
-- -> classes.teacher_id. Wrapped in a SECURITY DEFINER function for the
-- same reason as every other cross-table RLS check in this app (see
-- teaches_class/is_enrolled and the exam_assignments recursion fix): a
-- storage.objects policy that queried these tables directly, whose own
-- policies query back into exam_attempts/answers, risks the same kind of
-- recursion already hit and fixed once in
-- 20260717150200_fix_exam_assignment_rls_recursion.sql. A SECURITY
-- DEFINER function bypasses RLS on the tables it queries, so none of that
-- re-triggers here.
--
-- Only covers the class-quiz assignment flow (exam_assignments.class_id
-- is not null) - an admin/certification assignment (class_id null,
-- targeting an explicit student list) grants no teacher access, since
-- there is no "the class" for those. Admins can already read every
-- recording via the existing speaking_answers_select policy.

create function public.teaches_speaking_answer(object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.answers a
    join public.exam_attempts ea on ea.id = a.attempt_id
    join public.exam_assignment_students eas on eas.student_id = ea.student_id
    join public.exam_assignments eag on eag.id = eas.exam_assignment_id and eag.exam_id = ea.exam_id
    where a.response = object_name
      and eag.class_id is not null
      and public.teaches_class(eag.class_id)
  );
$$;

grant execute on function public.teaches_speaking_answer(text) to authenticated;

create policy "speaking_answers_teacher_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'speaking-answers'
    and public.teaches_speaking_answer(name)
  );
