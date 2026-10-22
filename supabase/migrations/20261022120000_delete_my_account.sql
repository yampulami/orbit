-- Lets a signed-in student (a guest included) delete their own account and everything tied to it, from inside the app.
-- Only ever the caller's own account: the function reads auth.uid() and takes no id from outside.
--
-- Deleting the account removes: the profile, campus membership, reminders, pins, push addresses, votes, RSVPs, direct messages,
-- group messages, posts and comments they wrote, and hangouts they organized.
-- One thing is kept on purpose: a group they started that other people are still in is handed to the longest-standing other member,
-- so friends do not lose their group (and its chat, plans and household) when its founder leaves.

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;

  update public.campus_groups g
  set created_by = (
    select m.user_id from public.campus_group_memberships m
    where m.group_id = g.id and m.user_id <> me
    order by m.joined_at, m.user_id
    limit 1
  )
  where g.created_by = me
    and exists (select 1 from public.campus_group_memberships m where m.group_id = g.id and m.user_id <> me);

  delete from auth.users where id = me;
end $$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
