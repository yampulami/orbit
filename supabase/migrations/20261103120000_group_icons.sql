-- A group chat can have an icon: a drawn icon from the app's library ("i:XX"), an emoji, or empty (its first letter).
alter table public.campus_groups add column if not exists icon text not null default '' check (char_length(icon) <= 8);

-- Anyone in the group may change it (people cannot edit the groups table directly).
create or replace function public.set_group_icon(gid uuid, gicon text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if char_length(coalesce(gicon, '')) > 8 then raise exception 'That icon is too long'; end if;
  if not exists (select 1 from public.campus_group_memberships m where m.group_id = gid and m.user_id = auth.uid()) then
    raise exception 'You are not in this group';
  end if;
  update public.campus_groups set icon = coalesce(gicon, '') where id = gid;
end;
$$;
revoke all on function public.set_group_icon(uuid, text) from public;
grant execute on function public.set_group_icon(uuid, text) to authenticated;
