-- MIG Classroom - initial schema
-- Creates all tables for people/courses, coursework, attendance, and exams.
-- Row-Level Security is enabled on every table with NO policies yet, so
-- every table is fully locked down (no anon/authenticated access) until
-- Step 3 adds role-based policies. The service_role key bypasses RLS,
-- which is how the app/CLI can still read and write during development.

create extension if not exists "pgcrypto" with schema extensions;

-- ============================================================
-- Enum types
-- ============================================================

create type public.user_role as enum ('student', 'teacher', 'admin');

create type public.course_level as enum ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

create type public.enrollment_status as enum ('active', 'completed', 'dropped');

create type public.submission_status as enum ('draft', 'submitted', 'late', 'graded');

create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');

create type public.question_type as enum (
  'multiple_choice',
  'true_false',
  'short_answer',
  'writing',
  'listening',
  'speaking'
);

create type public.exam_attempt_status as enum ('in_progress', 'submitted', 'graded', 'expired');

-- ============================================================
-- People & courses
-- ============================================================

-- One row per Supabase auth user. Deleting the auth user deletes the
-- profile (there's no reason to keep a profile with no account behind it).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level public.course_level not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

-- A running instance of a course (a specific cohort with a teacher and
-- dates). Deleting a course deletes its classes. Losing the teacher's
-- profile shouldn't delete the class - just leave it unassigned.
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  teacher_id uuid references public.profiles (id) on delete set null,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  constraint classes_date_range_check check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

create index classes_course_id_idx on public.classes (course_id);
create index classes_teacher_id_idx on public.classes (teacher_id);

alter table public.classes enable row level security;

-- Which students are in which class. Removing the class or the student's
-- profile removes the enrollment record with it.
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status public.enrollment_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint enrollments_class_student_unique unique (class_id, student_id)
);

create index enrollments_class_id_idx on public.enrollments (class_id);
create index enrollments_student_id_idx on public.enrollments (student_id);

alter table public.enrollments enable row level security;

-- ============================================================
-- Coursework
-- ============================================================

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null,
  instructions text,
  due_date timestamptz,
  max_points numeric(6, 2) not null default 100 check (max_points >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index assignments_class_id_idx on public.assignments (class_id);
create index assignments_created_by_idx on public.assignments (created_by);

alter table public.assignments enable row level security;

-- One submission per student per assignment. Deleting the assignment or
-- the student's profile deletes their submission with it.
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  content text,
  file_url text,
  submitted_at timestamptz,
  status public.submission_status not null default 'draft',
  created_at timestamptz not null default now(),
  constraint submissions_assignment_student_unique unique (assignment_id, student_id)
);

create index submissions_assignment_id_idx on public.submissions (assignment_id);
create index submissions_student_id_idx on public.submissions (student_id);

alter table public.submissions enable row level security;

-- One grade per submission. Losing the grader's profile keeps the grade
-- but drops the attribution.
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions (id) on delete cascade,
  points numeric(6, 2) not null check (points >= 0),
  feedback text,
  graded_by uuid references public.profiles (id) on delete set null,
  graded_at timestamptz not null default now()
);

create index grades_graded_by_idx on public.grades (graded_by);

alter table public.grades enable row level security;

-- ============================================================
-- Attendance
-- ============================================================

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  session_date date not null,
  topic text,
  created_at timestamptz not null default now()
);

create index class_sessions_class_id_idx on public.class_sessions (class_id);

alter table public.class_sessions enable row level security;

-- One attendance record per student per session.
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status public.attendance_status not null default 'present',
  note text,
  created_at timestamptz not null default now(),
  constraint attendance_session_student_unique unique (session_id, student_id)
);

create index attendance_session_id_idx on public.attendance (session_id);
create index attendance_student_id_idx on public.attendance (student_id);

alter table public.attendance enable row level security;

-- ============================================================
-- Exams
-- ============================================================

create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  level public.course_level not null,
  type public.question_type not null,
  prompt text not null,
  options jsonb,
  correct_answer text,
  points numeric(6, 2) not null default 1 check (points >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index question_bank_created_by_idx on public.question_bank (created_by);

alter table public.question_bank enable row level security;

-- class_id is nullable - an exam can be a standalone/certification exam
-- not tied to a specific class.
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level public.course_level not null,
  class_id uuid references public.classes (id) on delete set null,
  is_certification boolean not null default false,
  duration_minutes integer not null check (duration_minutes > 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index exams_class_id_idx on public.exams (class_id);
create index exams_created_by_idx on public.exams (created_by);

alter table public.exams enable row level security;

-- Which questions belong to which exam, in what order, with an optional
-- per-exam point override.
create table public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  question_id uuid not null references public.question_bank (id) on delete cascade,
  position integer not null,
  points_override numeric(6, 2) check (points_override >= 0),
  constraint exam_questions_exam_question_unique unique (exam_id, question_id),
  constraint exam_questions_exam_position_unique unique (exam_id, position)
);

create index exam_questions_question_id_idx on public.exam_questions (question_id);

alter table public.exam_questions enable row level security;

-- A student's attempt at an exam. No uniqueness constraint on
-- (exam_id, student_id) - retakes are allowed.
create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status public.exam_attempt_status not null default 'in_progress',
  total_score numeric(6, 2)
);

create index exam_attempts_exam_id_idx on public.exam_attempts (exam_id);
create index exam_attempts_student_id_idx on public.exam_attempts (student_id);

alter table public.exam_attempts enable row level security;

-- A student's answer to one question within one attempt. question_id
-- uses ON DELETE RESTRICT (not cascade): once a question has been
-- answered, it can no longer be deleted from the bank, protecting
-- historical exam records from silently disappearing. Teachers can still
-- freely delete unused questions - the delete is only blocked once real
-- answers exist against it.
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  question_id uuid not null references public.question_bank (id) on delete restrict,
  response text,
  is_correct boolean,
  points_awarded numeric(6, 2),
  graded_by uuid references public.profiles (id) on delete set null,
  constraint answers_attempt_question_unique unique (attempt_id, question_id)
);

create index answers_question_id_idx on public.answers (question_id);
create index answers_graded_by_idx on public.answers (graded_by);

alter table public.answers enable row level security;
