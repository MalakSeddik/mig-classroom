-- Step 5 part 2, Phase B: schema for exam assignment/scheduling + a few
-- columns needed for delivery, grading, and results.

-- A student can only ever take an exam that's been assigned to them -
-- never "by level". passing_score is nullable (only meaningful for
-- certification exams, and even then not force-required).
alter table public.exams
  add column passing_score numeric(6, 2) check (passing_score is null or passing_score >= 0);

-- Free-text feedback a teacher/admin leaves when grading a single answer
-- (separate from points_awarded).
alter table public.answers
  add column feedback text;

-- Multiple accepted answers for a short_answer question (e.g. "Berlin",
-- "berlin", "die Hauptstadt"), so grading isn't a brittle single exact
-- string match. correct_answer keeps holding the first/primary accepted
-- answer for backward-compatible display (the question list, etc.);
-- accepted_answers is the full list actually used for grading. Only
-- meaningful for type = 'short_answer' - null for every other type, same
-- "belt and suspenders, nulled server-side regardless of type" discipline
-- already used for options/correct_answer.
alter table public.question_bank
  add column accepted_answers jsonb;

-- Server-recorded flags from the exam-taking timer: a late submission (or
-- one the system had to auto-finalize because nobody submitted before the
-- deadline) is never discarded - these flags just make lateness visible
-- to staff, they don't zero out or penalize the score.
alter table public.exam_attempts
  add column is_late boolean not null default false;
alter table public.exam_attempts
  add column auto_submitted boolean not null default false;

-- Recreate exam_attempt_status with the real status flow this feature
-- needs (in_progress -> submitted -> auto_graded -> final, with expired
-- as a parallel "ran out the clock" outcome). Safe to drop and recreate
-- outright rather than ALTER TYPE ... ADD VALUE, since exam_attempts has
-- zero rows today (student exam-taking didn't exist before this step).
alter table public.exam_attempts alter column status drop default;
alter table public.exam_attempts alter column status type text using status::text;
drop type public.exam_attempt_status;
create type public.exam_attempt_status as enum ('in_progress', 'submitted', 'auto_graded', 'final', 'expired');
alter table public.exam_attempts alter column status type public.exam_attempt_status using status::public.exam_attempt_status;
alter table public.exam_attempts alter column status set default 'in_progress';

-- Previously "no uniqueness constraint - retakes are allowed" (see the
-- original schema's comment). This step deliberately changes that: one
-- attempt per student per exam, quizzes and finals alike.
alter table public.exam_attempts
  add constraint exam_attempts_one_per_student unique (exam_id, student_id);

-- Who may take which exam, and (for the admin/certification flow) within
-- what time window. class_id set = a class-targeted quiz, fanned out to
-- every currently-enrolled student at assignment time (a point-in-time
-- snapshot, same tradeoff the rest of the app already makes elsewhere -
-- a student enrolled afterward won't automatically see it). class_id
-- null = the admin flow, targeting an explicit list of students instead.
create table public.exam_assignments (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  class_id uuid references public.classes (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint exam_assignments_window_check check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

create index exam_assignments_exam_id_idx on public.exam_assignments (exam_id);
create index exam_assignments_class_id_idx on public.exam_assignments (class_id);

alter table public.exam_assignments enable row level security;

-- The per-student resolved view of exam_assignments - one row per student
-- who may take a given exam, whichever flow granted it.
create table public.exam_assignment_students (
  id uuid primary key default gen_random_uuid(),
  exam_assignment_id uuid not null references public.exam_assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint exam_assignment_students_unique unique (exam_assignment_id, student_id)
);

create index exam_assignment_students_student_id_idx on public.exam_assignment_students (student_id);

alter table public.exam_assignment_students enable row level security;
