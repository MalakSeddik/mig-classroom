-- Step 5 part 2, Phase A: storage policies for the speaking-answers
-- bucket, backing the standalone <AudioRecorder> component. Not wired
-- into exams yet - this just lets a student record and store an audio
-- clip somewhere private and safe; what it's *for* comes in a later part.
--
-- The speaking-answers bucket itself must be created manually in the
-- Supabase Dashboard first (private), the same way submissions/
-- materials/exam-media were - this migration only adds RLS policies on
-- storage.objects, it can't create the bucket itself.
--
-- Path convention: {student_id}/{filename} - same shape as the
-- submissions bucket, so (storage.foldername(name))[1] is the owning
-- student's id.
--
-- Deliberately no teacher read policy yet: "the relevant teacher" only
-- means something once a recording is linked to a specific exam
-- attempt/class, which doesn't exist until a future part wires this in.
-- Granting every teacher blanket read access to every student's
-- recordings now would be over-broad and hard to walk back later, so for
-- now only the owning student and admins (existing broad-access role,
-- same as everywhere else in this app) can read.

create policy "speaking_answers_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'speaking-answers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "speaking_answers_own_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'speaking-answers'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'speaking-answers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "speaking_answers_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'speaking-answers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "speaking_answers_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'speaking-answers'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
