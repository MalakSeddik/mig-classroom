-- Automatically create a profiles row whenever a new user signs up via
-- Supabase Auth (an insert into auth.users). full_name is read from the
-- signup form's metadata, but the role is a hardcoded literal below -
-- never taken from raw_user_meta_data or any other client-supplied
-- value. This is the only place a profile's role is ever set at
-- creation time, so a client can never request an elevated role at
-- signup by passing e.g. { data: { role: 'admin' } } to supabase.auth.signUp().
--
-- SECURITY DEFINER makes this function run with its owner's privileges
-- (bypassing profiles' RLS, which currently has zero policies and would
-- otherwise block the insert entirely). set search_path pins name
-- resolution to public, a standard hardening step for SECURITY DEFINER
-- functions so they can't be tricked by a session with a different
-- search_path.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'student');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
