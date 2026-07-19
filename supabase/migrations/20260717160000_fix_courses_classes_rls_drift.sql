-- NOTE (corrected after the fact): an initial verification pass during
-- the Step 6 part 2 admin panel work appeared to show `courses`
-- UPDATE/DELETE and `classes` UPDATE/DELETE weren't enforcing
-- admin-only in the live database. That turned out to be a false
-- positive in the test script itself - it checked only whether Supabase
-- returned an `error`, not whether any row was actually affected. A
-- `.update()`/`.delete()` blocked by RLS returns zero affected rows with
-- **no error**, exactly the gotcha this project's own "Access model
-- (RLS)" notes already call out. A corrected test (checking real row
-- effects via `.select()` after the write) confirmed the original
-- policies were correct all along.
--
-- This migration is therefore a no-op relative to
-- 20260717015807_add_rls_policies.sql - it drops and recreates the same
-- four policies with identical definitions. Left in place (rather than
-- deleted) as an honest record of the investigation, and because
-- drop-if-exists + recreate is harmless to leave applied.

drop policy if exists "courses_update_admin" on public.courses;
drop policy if exists "courses_delete_admin" on public.courses;
drop policy if exists "classes_update" on public.classes;
drop policy if exists "classes_delete_admin" on public.classes;

create policy "courses_update_admin" on public.courses
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "courses_delete_admin" on public.courses
  for delete to authenticated
  using (public.is_admin());

create policy "classes_update" on public.classes
  for update to authenticated
  using (public.is_admin() or teacher_id = auth.uid())
  with check (public.is_admin() or teacher_id = auth.uid());

create policy "classes_delete_admin" on public.classes
  for delete to authenticated
  using (public.is_admin());
