-- Seed script for local development / demo data.
-- Finds the teacher and student by email in auth.users (not something
-- application code ever does - profiles has no email column, this is a
-- one-off admin script), then creates one demo course, one class taught
-- by that teacher, and enrolls that student in it.
--
-- Safe to run only once per pair of emails - re-running will create a
-- second "German A2" course rather than erroring, since there's no
-- uniqueness constraint on course title.
do $$
declare
  v_teacher_id uuid;
  v_student_id uuid;
  v_course_id uuid;
  v_class_id uuid;
begin
  select id into v_teacher_id from auth.users where email = 'malak.seddik@yahoo.com';
  select id into v_student_id from auth.users where email = 'malakseddik3@gmail.com';

  if v_teacher_id is null then
    raise exception 'No auth user found for teacher email';
  end if;
  if v_student_id is null then
    raise exception 'No auth user found for student email';
  end if;

  -- The signup trigger defaults every new user to 'student', so the
  -- teacher account needs promoting. This runs as direct SQL (no
  -- authenticated session), so auth.uid() is null here - which is
  -- exactly the case the Step 3 part 2 bootstrap fix allows through.
  update public.profiles set role = 'teacher' where id = v_teacher_id;

  insert into public.courses (title, level, description)
  values ('German A2', 'A2', 'Demo course seeded for development.')
  returning id into v_course_id;

  insert into public.classes (course_id, name, teacher_id, start_date, end_date)
  values (v_course_id, 'German A2 - Morning', v_teacher_id, current_date, current_date + interval '3 months')
  returning id into v_class_id;

  insert into public.enrollments (class_id, student_id, status)
  values (v_class_id, v_student_id, 'active');

  raise notice 'Seeded course % / class %', v_course_id, v_class_id;
end $$;
