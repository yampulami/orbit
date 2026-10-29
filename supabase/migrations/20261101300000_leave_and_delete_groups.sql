-- Leaving and deleting groups.
--
--  leave_group:  any member can leave. The group leaves their list and the others keep it. Their answers to the group's hangouts go with them.
--                If they were the last member, the group is deleted.
--  delete_group: only the person who made the group can delete it, for everyone. Its chat, hangouts, answers and invite code go with it
--                (they are all tied to the group and are removed with it).

create or replace function public.leave_group(gid uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.campus_group_memberships where group_id = gid and user_id = me) then
    raise exception 'You are not in that group.' using errcode = 'P0001';
  end if;
  delete from public.campus_hangout_rsvps r using public.campus_hangouts h where r.hangout_id = h.id and h.group_id = gid and r.user_id = me;
  delete from public.campus_group_memberships where group_id = gid and user_id = me;
  if not exists (select 1 from public.campus_group_memberships where group_id = gid) then
    delete from public.campus_groups where id = gid;
    return 'deleted';
  end if;
  return 'left';
end;
$$;
grant execute on function public.leave_group(uuid) to authenticated;

create or replace function public.delete_group(gid uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.campus_groups where id = gid and created_by = me) then
    raise exception 'Only the person who made the group can delete it.' using errcode = 'P0001';
  end if;
  delete from public.campus_groups where id = gid;
end;
$$;
grant execute on function public.delete_group(uuid) to authenticated;
