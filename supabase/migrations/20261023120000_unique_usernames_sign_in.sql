-- Usernames become unique across the whole app (they were unique per campus), so a username can be used to sign in:
-- two students on different campuses can no longer both be "casey", and signing in as "casey" always means one person.

-- One leftover test account shared a username with another on a different campus. Give it a different one so the unique index can be built.
-- (Changes one test row's username; deletes nothing. A no-op if that account is already gone.)
update public.student_profiles set username = 'qa_other_u' where campus_key = 'qa-other-university' and username = 'qa_dana';

drop index if exists public.student_profiles_username_idx;
create unique index if not exists student_profiles_username_idx on public.student_profiles (username) where username is not null;

-- Names nobody should be able to take, so nobody can pose as the app.
alter table public.student_profiles drop constraint if exists student_profiles_username_reserved;
alter table public.student_profiles add constraint student_profiles_username_reserved
  check (username is null or username not in ('admin', 'administrator', 'orbit', 'support', 'staff', 'moderator', 'mod', 'help', 'system', 'root', 'official', 'team'));

-- Is this username free? Callable before anyone has an account, so the sign up form can say "taken" as you type.
-- It answers only yes or no: it does not say who has it or anything else about them.
create or replace function public.username_available(candidate text)
returns boolean language sql stable security definer set search_path = public
as $$
  select candidate ~ '^[a-z0-9_]{3,20}$'
     and candidate not in ('admin', 'administrator', 'orbit', 'support', 'staff', 'moderator', 'mod', 'help', 'system', 'root', 'official', 'team')
     and not exists (select 1 from public.student_profiles where username = candidate);
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
