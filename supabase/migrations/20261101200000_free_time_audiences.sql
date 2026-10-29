-- Free time, more control over who sees it.
--
--  1. Audience: all friends, or only friends you pick.
--  2. Housemates: people in your household group can see it too (so roommates can find a time), unless you switch that off.
--  3. Club counts: if you agree, you are counted in a club's "best meeting times" for its officers. They get numbers only ("12 of 18 free"), never names,
--     and nothing at all until at least 5 members have agreed.
--
-- Still off by default, and still only hours busy, never what for.

alter table public.availability_sharing
  add column if not exists audience text not null default 'friends',
  add column if not exists housemates boolean not null default true,
  add column if not exists club_counts boolean not null default false;

alter table public.availability_sharing drop constraint if exists availability_sharing_audience_check;
alter table public.availability_sharing add constraint availability_sharing_audience_check check (audience in ('friends', 'selected'));

create table if not exists public.availability_allowed (
  owner_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  primary key (owner_id, friend_id)
);
alter table public.availability_allowed enable row level security;

drop policy if exists "allowed own read" on public.availability_allowed;
create policy "allowed own read" on public.availability_allowed for select to authenticated using (owner_id = auth.uid());
-- No insert or delete policies: the list is written only through set_free_time_audience below.

-- Can the signed-in student see this person's busy blocks?
create or replace function public.can_see_free_time(owner uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and (
    owner = auth.uid()
    or (
      exists (select 1 from public.availability_sharing s where s.user_id = owner and s.enabled)
      and not public.is_blocked(auth.uid(), owner)
      and (
        -- a friend: any friend, or only the ones this person picked
        (
          exists (select 1 from public.friendships f where f.user_low = least(auth.uid(), owner) and f.user_high = greatest(auth.uid(), owner))
          and exists (
            select 1 from public.availability_sharing s
            where s.user_id = owner
              and (s.audience = 'friends' or exists (select 1 from public.availability_allowed a where a.owner_id = owner and a.friend_id = auth.uid()))
          )
        )
        -- a housemate: both are in the same household group, and the owner has not turned that off
        or (
          exists (select 1 from public.availability_sharing s where s.user_id = owner and s.housemates)
          and exists (
            select 1 from public.households h
            join public.campus_group_memberships mine on mine.group_id = h.group_id and mine.user_id = auth.uid()
            join public.campus_group_memberships theirs on theirs.group_id = h.group_id and theirs.user_id = owner
          )
        )
      )
    )
  );
$$;
grant execute on function public.can_see_free_time(uuid) to authenticated;

-- Set who may see your free time. `allowed` only matters when audience is 'selected', and only friends are kept. Sharing must be on first.
create or replace function public.set_free_time_audience(aud text, allowed uuid[], housemates_ boolean, club_ boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.' using errcode = 'P0001'; end if;
  if aud not in ('friends', 'selected') then raise exception 'Choose all friends or selected friends.' using errcode = 'P0001'; end if;
  if coalesce(array_length(allowed, 1), 0) > 100 then raise exception 'That is too many people.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.availability_sharing where user_id = me) then raise exception 'Turn on sharing first.' using errcode = 'P0001'; end if;
  update public.availability_sharing set audience = aud, housemates = coalesce(housemates_, true), club_counts = coalesce(club_, false), updated_at = now() where user_id = me;
  delete from public.availability_allowed where owner_id = me;
  if aud = 'selected' and allowed is not null then
    insert into public.availability_allowed (owner_id, friend_id)
    select me, u from unnest(allowed) as u
    where exists (select 1 from public.friendships f where f.user_low = least(me, u) and f.user_high = greatest(me, u))
    on conflict do nothing;
  end if;
end;
$$;
grant execute on function public.set_free_time_audience(text, uuid[], boolean, boolean) to authenticated;

-- Your own settings, in one go (the table rows are yours to read, but the allowed list is easier to read through here).
create or replace function public.my_free_time_audience()
returns table (enabled boolean, audience text, housemates boolean, club_counts boolean, allowed uuid[])
language sql stable security definer set search_path = public
as $$
  select s.enabled, s.audience, s.housemates, s.club_counts,
         coalesce((select array_agg(a.friend_id) from public.availability_allowed a where a.owner_id = s.user_id), '{}'::uuid[])
  from public.availability_sharing s where s.user_id = auth.uid();
$$;
grant execute on function public.my_free_time_audience() to authenticated;

-- A club's best meeting times, as numbers only. For the club's officers (anyone allowed to post its events), and only once at least 5 members
-- have agreed to be counted. `weekday` is 0 (Sunday) to 6, `slot` is the half hour of the day (0 = midnight, 18 = 9:00 AM).
create or replace function public.club_free_counts(org uuid)
returns table (weekday smallint, slot smallint, free integer, total integer)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_org_perm(org, 'events') then
    raise exception 'Only the club''s officers can see this.' using errcode = 'P0001';
  end if;
  return query
    with sh as (
      select s.user_id from public.availability_sharing s
      where s.enabled and s.club_counts
        and (
          exists (select 1 from public.campus_club_members c where c.org_id = org and c.user_id = s.user_id and c.status = 'member')
          or exists (select 1 from public.campus_org_members m where m.org_id = org and m.user_id = s.user_id)
        )
    ),
    n as (select count(*)::integer as c from sh)
    select d::smallint, g::smallint,
           (n.c - coalesce((select count(distinct b.user_id)::integer from public.busy_blocks b
                            where b.user_id in (select user_id from sh) and b.weekday = d and b.start_min < g * 30 + 30 and b.end_min > g * 30), 0))::integer,
           n.c
    from n, generate_series(0, 6) as d, generate_series(0, 47) as g
    where n.c >= 5; -- fewer than 5 would not be anonymous
end;
$$;
grant execute on function public.club_free_counts(uuid) to authenticated;

-- How many members have agreed to be counted, so officers can see how far off they are from 5. A number, no names.
create or replace function public.club_sharing_count(org uuid)
returns integer language sql stable security definer set search_path = public
as $$
  select case when public.has_org_perm(org, 'events') then (
    select count(*)::integer from public.availability_sharing s
    where s.enabled and s.club_counts
      and (
        exists (select 1 from public.campus_club_members c where c.org_id = org and c.user_id = s.user_id and c.status = 'member')
        or exists (select 1 from public.campus_org_members m where m.org_id = org and m.user_id = s.user_id)
      )
  ) else 0 end;
$$;
grant execute on function public.club_sharing_count(uuid) to authenticated;
