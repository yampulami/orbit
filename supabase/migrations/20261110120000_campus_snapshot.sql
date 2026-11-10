-- A small, counts-only summary of a campus for the setup screen: how many events are coming up, how many clubs are running,
-- and how many students have joined. It returns numbers only, never names, titles or people.
--   events:   published, not canceled, starting within the next 14 days
--   clubs:    active clubs
--   students: members of the campus, but only when there are at least 5 (a smaller number could point at one person), otherwise null
-- Any signed-in student can ask about any campus key, because they are choosing theirs before they have joined it.
create or replace function public.campus_snapshot(p_key text)
returns jsonb language sql stable security definer set search_path = public
as $$
  select case when p_key !~ '^[a-z0-9-]{2,100}$' then null else jsonb_build_object(
    'events', (select count(*) from public.campus_events e
                where e.campus_key = p_key and e.status = 'published' and e.canceled_at is null
                  and e.starts_at >= now() and e.starts_at < now() + interval '14 days'),
    'clubs', (select count(*) from public.campus_orgs o where o.campus_key = p_key and o.status = 'active'),
    'students', (select case when count(*) >= 5 then count(*) else null end from public.campus_memberships m where m.campus_key = p_key)
  ) end;
$$;
revoke all on function public.campus_snapshot(text) from public;
grant execute on function public.campus_snapshot(text) to authenticated;
