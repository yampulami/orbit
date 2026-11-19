-- Free time: friends no longer read the busy_blocks table directly.
--
-- Before: any friend allowed to see your free time could SELECT your rows from busy_blocks as often as they liked, so someone could poll for changes.
-- Now: the table is closed to everyone but its owner. Friends go through friend_busy_blocks(), which
--   * checks again, per person, that they may see that person's free time (sharing on, friends, not blocked, in the chosen audience),
--   * asks for at most 60 people at a time and at most 3000 rows back,
--   * allows 120 calls an hour per student (rate_limit_hit from the rate limits migration), so it cannot be used to watch someone's day.
-- The rows are still only weekday + start + end: no names, no places.

drop policy if exists "busy blocks readable by friends who may see them" on public.busy_blocks;
drop policy if exists "busy blocks own read" on public.busy_blocks;
create policy "busy blocks own read" on public.busy_blocks for select to authenticated using (user_id = auth.uid());

create or replace function public.friend_busy_blocks(ids uuid[])
returns table (user_id uuid, weekday smallint, start_min smallint, end_min smallint)
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.' using errcode = 'P0001'; end if;
  if coalesce(array_length(ids, 1), 0) = 0 then return; end if;
  if array_length(ids, 1) > 60 then raise exception 'That is too many people at once.' using errcode = 'P0001'; end if;
  if not public.rate_limit_hit('busy-read:' || me::text, 120, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'You are looking up free time too fast. Wait a little and try again.';
  end if;
  return query
    select b.user_id, b.weekday, b.start_min, b.end_min
    from public.busy_blocks b
    where b.user_id = any (ids) and b.user_id <> me and public.can_see_free_time(b.user_id)
    limit 3000;
end;
$$;
revoke all on function public.friend_busy_blocks(uuid[]) from public, anon;
grant execute on function public.friend_busy_blocks(uuid[]) to authenticated;
