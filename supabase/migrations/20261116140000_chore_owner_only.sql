-- A chore can be ticked off by anyone in the home, but only the person who made it can rename it, change who it is for, change its effort or due date,
-- or delete it. (The app already hides those controls for other people's chores; this makes the database say the same.)

drop policy if exists "household members remove" on public.household_tasks;
drop policy if exists "household creators remove" on public.household_tasks;
create policy "household creators remove" on public.household_tasks for delete to authenticated
using (public.is_campus_group_member(group_id) and created_by = auth.uid());

create or replace function public.household_task_owner_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or old.created_by is not distinct from auth.uid() then
    return new; -- our own functions, or the person who made it
  end if;
  if new.title is distinct from old.title
     or new.assignee is distinct from old.assignee
     or new.points is distinct from old.points
     or new.due_on is distinct from old.due_on
     or new.group_id is distinct from old.group_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Only the person who made this chore can change it.' using errcode = 'P0001';
  end if;
  return new; -- ticking it off (done, done_at) is for everyone in the home
end $$;
revoke all on function public.household_task_owner_check() from public, anon, authenticated;

drop trigger if exists household_tasks_owner on public.household_tasks;
create trigger household_tasks_owner before update on public.household_tasks for each row execute function public.household_task_owner_check();
