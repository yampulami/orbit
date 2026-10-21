-- Friend groups are private and joined with an invite code.
-- Before this, every student could see every group on their campus and could add themselves to any group they knew the id of.
-- After it: only members see a group and its member list, nobody can add themselves directly, and the only ways in are
-- create_friend_group (you become the first member) and join_group_with_code (you must know the code).

-- Two private groups may share a name, so the old "one name per campus" rule goes.
drop index if exists public.campus_groups_campus_name_idx;

create table if not exists public.group_invites (
  group_id uuid primary key references public.campus_groups(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{10}$'),
  created_at timestamptz not null default now()
);
alter table public.group_invites enable row level security;

-- Only members see a group's code, so they can pass it on. Nobody writes codes directly: the functions below do.
drop policy if exists "invite code members read" on public.group_invites;
create policy "invite code members read" on public.group_invites for select to authenticated
using (public.is_campus_group_member(group_id));

-- Groups and their member lists are visible to members only (the creator included, even before the first membership row exists).
drop policy if exists "campus groups read" on public.campus_groups;
drop policy if exists "my groups read" on public.campus_groups;
create policy "my groups read" on public.campus_groups for select to authenticated
using (campus_key = public.my_campus_key() and (created_by = auth.uid() or public.is_campus_group_member(id)));

drop policy if exists "group members read" on public.campus_group_memberships;
create policy "group members read" on public.campus_group_memberships for select to authenticated
using (public.is_campus_group_member(group_id));

-- No one adds themselves to a group directly any more.
drop policy if exists "join campus group" on public.campus_group_memberships;

-- Makes a group on the caller's campus, makes the caller its first member, and returns the invite code.
create or replace function public.create_friend_group(gid uuid, gname text)
returns text language plpgsql security definer set search_path = public
as $$
declare
  ck text := public.my_campus_key();
  c text;
begin
  if auth.uid() is null or ck is null then
    raise exception 'Join a campus first.' using errcode = 'P0001';
  end if;
  if char_length(btrim(gname)) not between 2 and 100 then
    raise exception 'Give the group a name between 2 and 100 characters.' using errcode = 'P0001';
  end if;
  insert into public.campus_groups (id, campus_key, name, created_by) values (gid, ck, btrim(gname), auth.uid());
  insert into public.campus_group_memberships (group_id, user_id) values (gid, auth.uid());
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into public.group_invites (group_id, code) values (gid, c);
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  return c;
end $$;
revoke all on function public.create_friend_group(uuid, text) from public;
grant execute on function public.create_friend_group(uuid, text) to authenticated;

-- Joins the group that owns this code, if it is on the caller's campus. Joining twice is fine. Returns the group id.
create or replace function public.join_group_with_code(invite text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare gid uuid;
begin
  if auth.uid() is null or public.my_campus_key() is null then
    raise exception 'Join a campus first.' using errcode = 'P0001';
  end if;
  select i.group_id into gid
  from public.group_invites i join public.campus_groups g on g.id = i.group_id
  where i.code = upper(btrim(invite)) and g.campus_key = public.my_campus_key();
  if gid is null then
    raise exception 'That code does not match a group on your campus.' using errcode = 'P0001';
  end if;
  insert into public.campus_group_memberships (group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  return gid;
end $$;
revoke all on function public.join_group_with_code(text) from public;
grant execute on function public.join_group_with_code(text) to authenticated;

-- The creator can replace the code, for example if it ended up somewhere it should not be. The old code stops working at once.
create or replace function public.regenerate_group_code(gid uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare c text;
begin
  if not exists (select 1 from public.campus_groups where id = gid and created_by = auth.uid()) then
    raise exception 'Only the person who made the group can change its code.' using errcode = 'P0001';
  end if;
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      update public.group_invites set code = c, created_at = now() where group_id = gid;
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  return c;
end $$;
revoke all on function public.regenerate_group_code(uuid) from public;
grant execute on function public.regenerate_group_code(uuid) to authenticated;
