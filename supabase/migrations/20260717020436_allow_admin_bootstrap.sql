-- Fixes a bootstrapping problem discovered while testing: the role-
-- protection trigger blocks a role change unless is_admin() is true, but
-- is_admin() itself depends on auth.uid() - which is NULL for requests
-- that aren't a real signed-in user's session (the service_role key, or
-- SQL run directly in the Dashboard's SQL Editor). With no admin yet in
-- the system, there was no way to ever create the first one.
--
-- This allows the role column to change when auth.uid() is null, i.e.
-- only for trusted server-side contexts that already fully bypass RLS
-- anyway (service_role, direct SQL). A real signed-in user always has a
-- non-null auth.uid(), so this changes nothing about what an ordinary
-- authenticated user (even one who happens to be a teacher) can do to
-- their own or anyone else's role - they still can never change it.
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
  return new;
end;
$$;
