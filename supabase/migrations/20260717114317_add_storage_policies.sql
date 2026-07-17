-- Step 4 part 2: storage policies for the "submissions" and "materials"
-- buckets (both already created, both private - never expose either via
-- public URLs; the app always generates short-lived signed URLs
-- server-side for viewing/downloading).
--
-- storage.foldername(name) splits an object's path into its folder
-- segments. For "submissions" the path is
-- {class_id}/{assignment_id}/{student_id}/{filename}, so:
--   (storage.foldername(name))[1] = class_id
--   (storage.foldername(name))[3] = student_id
-- For "materials" the path is {class_id}/{assignment_id}/{filename}, so
--   (storage.foldername(name))[1] = class_id
-- These policies reuse the exact same is_admin()/teaches_class()/
-- is_enrolled() helper functions from Step 3 part 2 - no new helpers
-- needed, since storage.objects is just another RLS-protected table.

-- ============================================================
-- submissions bucket
-- ============================================================
-- Write access belongs only to the owning student - not even a teacher
-- or admin can upload/replace a student's submission file, matching how
-- the submissions table itself only ever allows the owning student to
-- write (Step 3 part 2).

create policy "submissions_bucket_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[3] = auth.uid()::text
    and public.is_enrolled((storage.foldername(name))[1]::uuid)
  );

create policy "submissions_bucket_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[3] = auth.uid()::text
  )
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[3] = auth.uid()::text
    and public.is_enrolled((storage.foldername(name))[1]::uuid)
  );

create policy "submissions_bucket_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[3] = auth.uid()::text
  );

create policy "submissions_bucket_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (
      (storage.foldername(name))[3] = auth.uid()::text
      or public.teaches_class((storage.foldername(name))[1]::uuid)
      or public.is_admin()
    )
  );

-- ============================================================
-- materials bucket
-- ============================================================
-- Write access is staff-only; read access also includes enrolled
-- students, mirroring assignment_materials' own table policies.

create policy "materials_bucket_insert_staff" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materials'
    and (public.teaches_class((storage.foldername(name))[1]::uuid) or public.is_admin())
  );

create policy "materials_bucket_update_staff" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'materials'
    and (public.teaches_class((storage.foldername(name))[1]::uuid) or public.is_admin())
  )
  with check (
    bucket_id = 'materials'
    and (public.teaches_class((storage.foldername(name))[1]::uuid) or public.is_admin())
  );

create policy "materials_bucket_delete_staff" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materials'
    and (public.teaches_class((storage.foldername(name))[1]::uuid) or public.is_admin())
  );

create policy "materials_bucket_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materials'
    and (
      public.is_enrolled((storage.foldername(name))[1]::uuid)
      or public.teaches_class((storage.foldername(name))[1]::uuid)
      or public.is_admin()
    )
  );
