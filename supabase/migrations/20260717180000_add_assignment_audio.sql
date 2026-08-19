-- Wiring <AudioRecorder> into assignments, in practice mode (free
-- re-record, generous limits - unlike the invigilated exam flow).

-- Teacher-settable per assignment: does this assignment need a spoken
-- answer? Defaults false so every existing assignment is unaffected.
alter table public.assignments
  add column requires_audio boolean not null default false;

-- Student's recorded answer, if any - a speaking-answers storage path,
-- same convention as answers.response for a speaking exam question.
-- Nullable and independent of content/file_path: a submission can carry
-- text, a file, audio, or any combination.
alter table public.submissions
  add column audio_path text;

-- Widen the existing teacher read policy on the speaking-answers bucket
-- (20260717170000_add_speaking_answers_teacher_policy.sql) to also cover
-- assignment recordings, instead of adding a second near-duplicate
-- policy. A speaking-answers object's path is still just
-- {student_id}/{filename} with no class segment, so this needs its own
-- join chain - submissions -> assignments -> classes.teacher_id - which
-- is actually simpler than the exam chain above (assignments has its own
-- class_id directly, no assignment/exam_assignment_students indirection).
-- Same SECURITY DEFINER reasoning as before: this bypasses RLS on the
-- tables it queries, so it can't recurse back into this policy.
create or replace function public.teaches_speaking_answer(object_name text)
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
  ) or exists (
    select 1
    from public.submissions s
    join public.assignments asg on asg.id = s.assignment_id
    where s.audio_path = object_name
      and public.teaches_class(asg.class_id)
  );
$$;
