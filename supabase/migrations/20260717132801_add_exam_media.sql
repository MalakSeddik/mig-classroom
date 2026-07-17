-- Step 5 part 1: exam authoring - question media + the exam-media bucket.

-- A question may optionally have one attached audio clip or image.
-- media_type is the file's mime type, used to decide how to render it
-- (e.g. an inline audio player vs an image/link).
alter table public.question_bank add column media_path text;
alter table public.question_bank add column media_type text;

-- exam-media bucket (already created, private): staff-only for every
-- operation, same is_admin()/is_teacher() condition reused from the
-- Step 3 part 2 table policies on question_bank/exams/etc. Students get
-- no access at all in this part - scoped student access to specific
-- exam media is part 2's problem, not this migration's.
create policy "exam_media_staff_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'exam-media' and (public.is_admin() or public.is_teacher()))
  with check (bucket_id = 'exam-media' and (public.is_admin() or public.is_teacher()));
