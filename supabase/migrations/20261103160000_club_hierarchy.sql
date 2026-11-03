-- A real hierarchy for clubs: president, then roles in order, then members. Nobody can act on a person at or above their own rank, hand out
-- more power than they hold, or lock out the people above them. Also: adding people straight into a club, handing the presidency over, putting roles
-- in order, and a guard so a student cannot name their club like a university office.
-- (Builds on 20261103140000_event_sources.sql and the club roles migrations.)

-- 1. Rank: lower is more powerful -------------------------------------------------------------------------------------------------------------
--   president 0 | a role: 10 + its place in the list | team member with no role 5000 | club member 9000 | not in the club 10000
create or replace function public.org_rank(org uuid, uid uuid)
returns integer language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select case
       when m.role = 'owner' then 0
       when m.role_id is not null then 10 + coalesce((select r.position from public.campus_org_roles r where r.id = m.role_id), 4000)
       else 5000
     end from public.campus_org_members m where m.org_id = org and m.user_id = uid),
    (select 9000 from public.campus_club_members c where c.org_id = org and c.user_id = uid and c.status = 'member'),
    10000)
$$;
-- The caller's rank; a coordinator or staff host outranks everyone (they already can moderate every club).
create or replace function public.my_org_rank(org uuid)
returns integer language sql stable security definer set search_path = public
as $$ select case when public.can_review_events() then -1 else public.org_rank(org, auth.uid()) end $$;
revoke all on function public.org_rank(uuid, uuid) from public;
revoke all on function public.my_org_rank(uuid) from public;
grant execute on function public.org_rank(uuid, uuid) to authenticated;
grant execute on function public.my_org_rank(uuid) to authenticated;

-- 2. Roles: you can only change roles below yours, and hand out only powers you hold ---------------------------------------------------------
create or replace function public.save_org_role(org uuid, role_id uuid, role_name text, perms text[])
returns uuid language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs; rid uuid; clean text[]; nm text := trim(coalesce(role_name, '')); mine integer := public.my_org_rank(org); mine_perms text[];
begin
  select * into o from public.campus_orgs where id = org;
  if o.id is null or o.campus_key <> public.my_campus_key() then raise exception 'That club does not exist.' using errcode = '42501'; end if;
  if not (public.is_org_owner(org) or public.has_org_perm(org, 'roles') or public.can_review_events()) then raise exception 'Only people who manage roles can do that.' using errcode = '42501'; end if;
  if char_length(nm) not between 1 and 30 then raise exception 'Give the role a name (up to 30 characters).'; end if;
  clean := array(select distinct p from unnest(coalesce(perms, '{}'::text[])) p where p = any (array['announce', 'events', 'members', 'roles', 'tasks', 'polls', 'moderate', 'channels']));
  -- Only the president (or a coordinator) can hand out the power to manage roles, and nobody can give a role a power they do not have.
  if not (public.is_org_owner(org) or public.can_review_events()) then
    mine_perms := coalesce(public.org_perms(org, auth.uid()), '{}'::text[]);
    clean := array(select p from unnest(clean) p where p = any (mine_perms) and p <> 'roles');
  end if;
  if role_id is null then
    if (select count(*) from public.campus_org_roles where org_id = org) >= 12 then raise exception 'A club can have up to 12 roles.'; end if;
    insert into public.campus_org_roles (org_id, name, permissions, position)
    values (org, nm, clean, (select coalesce(max(position), 0) + 1 from public.campus_org_roles where org_id = org)) returning id into rid;
  else
    if mine > 0 and 10 + coalesce((select position from public.campus_org_roles where id = role_id), 0) <= mine then
      raise exception 'You can only change roles below your own.' using errcode = '42501';
    end if;
    update public.campus_org_roles set name = nm, permissions = clean where id = role_id and org_id = org returning id into rid;
    if rid is null then raise exception 'That role does not exist.'; end if;
  end if;
  return rid;
exception when unique_violation then raise exception 'There is already a role with that name.';
end $$;

create or replace function public.delete_org_role(role uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare r public.campus_org_roles; mine integer;
begin
  select * into r from public.campus_org_roles where id = role;
  if r.id is null then return; end if;
  mine := public.my_org_rank(r.org_id);
  if not (public.is_org_owner(r.org_id) or public.has_org_perm(r.org_id, 'roles') or public.can_review_events()) then raise exception 'Only people who manage roles can do that.' using errcode = '42501'; end if;
  if mine > 0 and 10 + r.position <= mine then raise exception 'You can only delete roles below your own.' using errcode = '42501'; end if;
  if exists (select 1 from public.campus_org_members where role_id = role) then raise exception 'Move the people in this role to another role first.'; end if;
  delete from public.campus_org_roles where id = role;
end $$;

-- Move a role up or down the list (the president, or a coordinator).
create or replace function public.move_org_role(role uuid, direction integer)
returns void language plpgsql security definer set search_path = public
as $$
declare r public.campus_org_roles; n public.campus_org_roles;
begin
  select * into r from public.campus_org_roles where id = role;
  if r.id is null then raise exception 'That role does not exist.'; end if;
  if not (public.is_org_owner(r.org_id) or public.can_review_events()) then raise exception 'Only the president can put roles in order.' using errcode = '42501'; end if;
  if direction < 0 then
    select * into n from public.campus_org_roles where org_id = r.org_id and position < r.position order by position desc limit 1;
  else
    select * into n from public.campus_org_roles where org_id = r.org_id and position > r.position order by position asc limit 1;
  end if;
  if n.id is null then return; end if;
  update public.campus_org_roles set position = case when id = r.id then n.position else r.position end where id in (r.id, n.id);
end $$;
revoke all on function public.move_org_role(uuid, integer) from public;
grant execute on function public.move_org_role(uuid, integer) to authenticated;

-- 3. People: put someone on the team in a role, or take the role away (back to an ordinary member) ----------------------------------------------
--    The role must rank below yours, and so must the person you are changing (the president and anyone at your rank or above are out of reach).
create or replace function public.set_member_role(org uuid, member uuid, role uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs; r public.campus_org_roles; mine integer := public.my_org_rank(org); theirs integer := public.org_rank(org, member);
begin
  select * into o from public.campus_orgs where id = org;
  if o.id is null or o.campus_key <> public.my_campus_key() then raise exception 'That club does not exist.' using errcode = '42501'; end if;
  if not (public.is_org_owner(org) or public.has_org_perm(org, 'roles') or public.can_review_events()) then raise exception 'Only people who manage roles can do that.' using errcode = '42501'; end if;
  if not exists (select 1 from public.campus_memberships c where c.user_id = member and c.campus_key = o.campus_key) then raise exception 'That person is not on your campus.'; end if;
  if theirs = 0 then raise exception 'The president already has every permission.'; end if;
  if member = auth.uid() and mine > 0 then raise exception 'You cannot change your own role.' using errcode = '42501'; end if;
  if mine >= 0 and theirs <= mine then raise exception 'You can only change people ranked below you.' using errcode = '42501'; end if;
  if role is null then
    -- Back to an ordinary member of the club.
    delete from public.campus_org_members where org_id = org and user_id = member;
    insert into public.campus_club_members (org_id, user_id, status, decided_by, decided_at) values (org, member, 'member', auth.uid(), now())
    on conflict (org_id, user_id) do update set status = 'member', decided_by = auth.uid(), decided_at = now();
    return;
  end if;
  select * into r from public.campus_org_roles where id = role and org_id = org;
  if r.id is null then raise exception 'That role does not exist.'; end if;
  if mine >= 0 and 10 + r.position <= mine then raise exception 'You can only give roles below your own.' using errcode = '42501'; end if;
  insert into public.campus_org_members (org_id, user_id, role, role_id) values (org, member, 'officer', role)
  on conflict (org_id, user_id) do update set role_id = excluded.role_id;
  if member <> auth.uid() then
    insert into public.notifications (recipient_id, actor_id, kind, body) values (member, auth.uid(), 'event', left('You are now ' || r.name || ' in ' || o.name, 200));
  end if;
end $$;

-- Take someone out of the club altogether (team and membership), or leave it yourself. Only people ranked below you, by someone who manages members.
create or replace function public.remove_org_member(org uuid, member uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare mine integer := public.my_org_rank(org); theirs integer := public.org_rank(org, member);
begin
  if member = auth.uid() then
    if theirs = 0 and (select count(*) from public.campus_org_members where org_id = org and role = 'owner') <= 1 then
      raise exception 'A club needs a president. Hand the presidency to someone else first.';
    end if;
  else
    if not (public.has_org_perm(org, 'members') or public.has_org_perm(org, 'roles') or public.is_org_owner(org) or public.can_review_events()) then raise exception 'Only people who manage members can remove someone.' using errcode = '42501'; end if;
    if theirs = 0 then raise exception 'The president cannot be removed. They can hand the presidency over first.' using errcode = '42501'; end if;
    if mine >= 0 and theirs <= mine then raise exception 'You can only remove people ranked below you.' using errcode = '42501'; end if;
  end if;
  delete from public.campus_org_members where org_id = org and user_id = member;
  delete from public.campus_club_members where org_id = org and user_id = member;
end $$;

-- Add someone to the club as a member straight away (no request needed). For people who manage members.
create or replace function public.add_club_member(org uuid, member uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs;
begin
  select * into o from public.campus_orgs where id = org;
  if o.id is null or o.campus_key <> public.my_campus_key() or o.status <> 'active' then raise exception 'That club is not taking members right now.' using errcode = '42501'; end if;
  if not (public.has_org_perm(org, 'members') or public.is_org_owner(org) or public.can_review_events()) then raise exception 'Only people who manage members can add someone.' using errcode = '42501'; end if;
  if not exists (select 1 from public.campus_memberships c where c.user_id = member and c.campus_key = o.campus_key) then raise exception 'That person is not on your campus.'; end if;
  if public.is_blocked(auth.uid(), member) then raise exception 'You cannot add that person.' using errcode = '42501'; end if;
  if exists (select 1 from public.campus_org_members m where m.org_id = org and m.user_id = member) then return; end if;
  insert into public.campus_club_members (org_id, user_id, status, decided_by, decided_at) values (org, member, 'member', auth.uid(), now())
  on conflict (org_id, user_id) do update set status = 'member', decided_by = auth.uid(), decided_at = now();
  if member <> auth.uid() then
    insert into public.notifications (recipient_id, actor_id, kind, body) values (member, auth.uid(), 'event', left('You were added to ' || o.name, 200));
  end if;
end $$;

-- Hand the presidency to someone on the team (or any member). The old president stays on as a team member with the club's top role, if there is one.
create or replace function public.transfer_org_ownership(org uuid, member uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs; top uuid; was uuid;
begin
  select * into o from public.campus_orgs where id = org;
  if o.id is null or o.campus_key <> public.my_campus_key() then raise exception 'That club does not exist.' using errcode = '42501'; end if;
  if not (public.is_org_owner(org) or public.can_review_events()) then raise exception 'Only the president can hand over the presidency.' using errcode = '42501'; end if;
  if member = auth.uid() and public.is_org_owner(org) then return; end if;
  if not exists (select 1 from public.campus_memberships c where c.user_id = member and c.campus_key = o.campus_key) then raise exception 'That person is not on your campus.'; end if;
  select user_id into was from public.campus_org_members where org_id = org and role = 'owner' order by created_at limit 1;
  select id into top from public.campus_org_roles where org_id = org order by position limit 1;
  if was is not null then update public.campus_org_members set role = 'officer', role_id = top where org_id = org and user_id = was; end if;
  insert into public.campus_org_members (org_id, user_id, role, role_id) values (org, member, 'owner', null)
  on conflict (org_id, user_id) do update set role = 'owner', role_id = null;
  delete from public.campus_club_members where org_id = org and user_id = member;
  insert into public.notifications (recipient_id, actor_id, kind, body) values (member, auth.uid(), 'event', left('You are now the president of ' || o.name, 200));
end $$;
revoke all on function public.add_club_member(uuid, uuid) from public;
revoke all on function public.transfer_org_ownership(uuid, uuid) from public;
grant execute on function public.add_club_member(uuid, uuid) to authenticated;
grant execute on function public.transfer_org_ownership(uuid, uuid) to authenticated;

-- Adding someone to the team without a role is the same as putting them in the club's lowest role: only people who manage members or roles, below them.
create or replace function public.add_org_member(org uuid, member uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs;
begin
  select * into o from public.campus_orgs where id = org;
  if o.id is null then raise exception 'That organization does not exist.'; end if;
  if not (public.is_org_owner(org) or public.can_review_events()) then raise exception 'Only the president can add people to the team without a role. Give them a role instead.' using errcode = '42501'; end if;
  if not exists (select 1 from public.campus_memberships c where c.user_id = member and c.campus_key = o.campus_key) then raise exception 'That person is not on your campus.'; end if;
  insert into public.campus_org_members (org_id, user_id, role) values (org, member, 'officer') on conflict do nothing;
  if member <> auth.uid() then
    insert into public.notifications (recipient_id, actor_id, kind, body) values (member, auth.uid(), 'event', left('You were added to ' || o.name || ' as an officer', 200));
  end if;
end $$;

-- 4. A student cannot name a club like a university office, or like an existing official one --------------------------------------------------
create or replace function public.org_name_key(n text)
returns text language sql immutable
as $$ select regexp_replace(regexp_replace(lower(coalesce(n, '')), '\m(the|of|and|club|office|society|association)\M', ' ', 'g'), '[^a-z0-9]+', '', 'g') $$;

create or replace function public.campus_org_name_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare plain text := lower(regexp_replace(new.name, '[^a-zA-Z0-9 ]+', ' ', 'g'));
begin
  if auth.uid() is null or public.can_review_events() then return new; end if;
  if plain ~ '\m(office|offices|department|dept|administration|administrator|admin|admissions|registrar|bursar|provost|dean|chancellor|official|staff|faculty|campus security|campus police|public safety|financial aid|student life|student affairs|student engagement|human resources|title ix)\M' then
    raise exception 'That name is for official campus offices. Pick a different name, or ask a coordinator to create it.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.campus_orgs o where o.campus_key = new.campus_key and o.kind = 'official' and o.id <> new.id and public.org_name_key(o.name) = public.org_name_key(new.name) and public.org_name_key(new.name) <> '') then
    raise exception 'That is too close to the name of an official campus office. Pick a different name.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists campus_org_name_guard on public.campus_orgs;
create trigger campus_org_name_guard before insert on public.campus_orgs for each row execute function public.campus_org_name_guard();
