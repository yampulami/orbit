-- Shared free time: a student can let their friends see WHEN they are busy (weekly blocks), never what for.
--
-- Off by default. Only the student turns it on or off. Only friends (and not people they have blocked) can read the blocks, and only while sharing is on.
-- Turning sharing off deletes the blocks. The blocks hold no class names or places: just a weekday and a start and end minute.

create table if not exists public.availability_sharing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.busy_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_min smallint not null check (start_min between 0 and 1439),
  end_min smallint not null check (end_min between 1 and 1440),
  check (end_min > start_min)
);
create index if not exists busy_blocks_user_idx on public.busy_blocks(user_id);

alter table public.availability_sharing enable row level security;
alter table public.busy_blocks enable row level security;

-- Can the signed-in student see this person's busy blocks? Yes if it is them, or they are friends, sharing is on and neither has blocked the other.
create or replace function public.can_see_free_time(owner uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and (
    owner = auth.uid()
    or (
      exists (select 1 from public.availability_sharing s where s.user_id = owner and s.enabled)
      and exists (select 1 from public.friendships f where f.user_low = least(auth.uid(), owner) and f.user_high = greatest(auth.uid(), owner))
      and not public.is_blocked(auth.uid(), owner)
    )
  );
$$;
grant execute on function public.can_see_free_time(uuid) to authenticated;

-- Your own switch is yours to read and write. Friends learn whether you share only by being able to read your blocks.
drop policy if exists "sharing own read" on public.availability_sharing;
create policy "sharing own read" on public.availability_sharing for select to authenticated using (user_id = auth.uid());
drop policy if exists "sharing own insert" on public.availability_sharing;
create policy "sharing own insert" on public.availability_sharing for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "sharing own update" on public.availability_sharing;
create policy "sharing own update" on public.availability_sharing for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "busy blocks readable by friends who may see them" on public.busy_blocks;
create policy "busy blocks readable by friends who may see them" on public.busy_blocks for select to authenticated using (public.can_see_free_time(user_id));
-- No insert, update or delete policies: blocks are written only through the function below.

-- Replace your own blocks in one go (at most 100). Only works while sharing is on, so nothing is stored for someone who has not agreed.
create or replace function public.set_busy_blocks(blocks jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  b jsonb;
begin
  if me is null then raise exception 'Sign in first.' using errcode = 'P0001'; end if;
  if jsonb_typeof(blocks) is distinct from 'array' or jsonb_array_length(blocks) > 100 then
    raise exception 'That is too many blocks.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.availability_sharing where user_id = me and enabled) then
    raise exception 'Turn on sharing first.' using errcode = 'P0001';
  end if;
  delete from public.busy_blocks where user_id = me;
  for b in select * from jsonb_array_elements(blocks) loop
    insert into public.busy_blocks (user_id, weekday, start_min, end_min)
    values (me, (b->>'d')::smallint, (b->>'s')::smallint, (b->>'e')::smallint);
  end loop;
end;
$$;
grant execute on function public.set_busy_blocks(jsonb) to authenticated;

-- Turning sharing off removes what was stored.
create or replace function public.set_free_time_sharing(on_ boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.' using errcode = 'P0001'; end if;
  insert into public.availability_sharing (user_id, enabled, updated_at) values (me, on_, now())
  on conflict (user_id) do update set enabled = excluded.enabled, updated_at = now();
  if not on_ then delete from public.busy_blocks where user_id = me; end if;
end;
$$;
grant execute on function public.set_free_time_sharing(boolean) to authenticated;

-- Which of these people are sharing their free time with you right now? (Never includes you.) A friend who shares but has no classes still counts.
create or replace function public.free_time_sharers(ids uuid[])
returns setof uuid language sql stable security definer set search_path = public
as $$
  select u from unnest(ids) as u where u <> auth.uid() and public.can_see_free_time(u);
$$;
grant execute on function public.free_time_sharers(uuid[]) to authenticated;
