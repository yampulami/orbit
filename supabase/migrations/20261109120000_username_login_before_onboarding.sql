-- Signing in by username used to work only after onboarding, because the sign-in function looked the name up in student_profiles,
-- which is created on the last onboarding step. Until then the name chosen at sign up exists only in the account's sign-up data.
-- This lookup checks both, and is callable by the server only (never by the app), so nobody can ask "what is the email for this name?".

create or replace function public.login_user_for_username(candidate text)
returns uuid language sql stable security definer set search_path = public, auth
as $$
  select coalesce(
    (select user_id from public.student_profiles where username = lower(candidate) limit 1),
    (select id from auth.users where lower(raw_user_meta_data ->> 'username') = lower(candidate) order by created_at limit 1)
  );
$$;
revoke all on function public.login_user_for_username(text) from public, anon, authenticated;
grant execute on function public.login_user_for_username(text) to service_role;

-- A name someone has picked at sign up but not finished onboarding with is taken too; otherwise two people could hold it and the
-- first to finish would silently win the sign-in.
create or replace function public.username_available(candidate text)
returns boolean language sql stable security definer set search_path = public, auth
as $$
  select candidate ~ '^[a-z0-9_]{3,20}$'
     and candidate not in ('admin', 'administrator', 'orbit', 'support', 'staff', 'moderator', 'mod', 'help', 'system', 'root', 'official', 'team')
     and not exists (select 1 from public.student_profiles where username = candidate)
     and not exists (select 1 from auth.users where lower(raw_user_meta_data ->> 'username') = candidate and id is distinct from auth.uid());
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
