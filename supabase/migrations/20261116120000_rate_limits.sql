-- Rate limits on the server, where they cannot be bypassed by clearing the browser.
--
-- 1. rate_limit_hit(key, max, window): counts a try under a key and says whether it is allowed. Only the server side (service role, used by the
--    sign-in function) may call it, so nobody can read or reset the counters.
-- 2. enforce_insert_rate(): a trigger that stops one signed-in person from creating rows in a table faster than a sensible person would
--    (spam posts, message floods, report floods). Signed-in people only; the service role (our own functions) is not limited.
--
-- Supabase Auth has its own limits for sign up, sign in, password reset and email sending; set them in the dashboard
-- (Authentication > Rate Limits). They are not in SQL.

create table if not exists public.rate_limit_hits (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists rate_limit_hits_key_at on public.rate_limit_hits (key, at desc);
alter table public.rate_limit_hits enable row level security; -- no policies: closed to the app, open only to the service role

create or replace function public.rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if random() < 0.02 then
    delete from public.rate_limit_hits where at < now() - interval '1 day';
  end if;
  select count(*) into n from public.rate_limit_hits where key = p_key and at > now() - make_interval(secs => p_window_seconds);
  if n >= p_max then
    return false;
  end if;
  insert into public.rate_limit_hits (key) values (p_key);
  return true;
end;
$$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- Trigger: enforce_insert_rate(max, window_seconds). A person who goes over gets the error "rate_limited" (the app shows a calm message).
create or replace function public.enforce_insert_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  max_n int := tg_argv[0]::int;
  win int := tg_argv[1]::int;
begin
  if uid is null then
    return new; -- our own functions and migrations
  end if;
  if not public.rate_limit_hit(tg_table_name || ':' || uid::text, max_n, win) then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'You are doing that too fast. Wait a little and try again.';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_insert_rate() from public, anon, authenticated;

-- rate_limit_hit is called from the trigger (which runs as its owner), so it does not need to be callable by the app.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      -- table,                      max, window seconds
      ('campus_posts',                10,   600),   -- 10 posts / 10 min
      ('post_comments',               30,   600),
      ('campus_club_posts',           20,  3600),
      ('campus_club_post_comments',   30,   600),
      ('direct_messages',             60,    60),   -- 60 messages / minute
      ('group_messages',              60,    60),
      ('campus_club_messages',        60,    60),
      ('direct_conversations',        20,  3600),   -- new chats and message requests
      ('student_follows',             60,  3600),
      ('campus_listings',             10,  3600),
      ('campus_listing_reports',      10,  3600),
      ('content_reports',             10,  3600),
      ('campus_event_reports',        10,  3600),
      ('campus_groups',               10,  3600),
      ('campus_hangouts',             20,  3600),
      ('campus_events',               10,  3600),
      ('campus_orgs',                  5, 86400),
      ('event_registrations',         60,  3600)
    ) as v(tbl, mx, win)
  loop
    if to_regclass('public.' || t.tbl) is not null then
      execute format('drop trigger if exists %I on public.%I', t.tbl || '_rate', t.tbl);
      execute format('create trigger %I before insert on public.%I for each row execute function public.enforce_insert_rate(%s, %s)', t.tbl || '_rate', t.tbl, t.mx, t.win);
    end if;
  end loop;
end $$;
