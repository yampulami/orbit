-- Club tasks: the team hands out jobs (and volunteer slots) to people in the club and tracks them on a dashboard.
--   - People whose role includes "assign tasks" (and the president) create, assign, edit and delete tasks.
--   - The team sees every task; a member sees only the ones assigned to them, and can move those along (to do, doing, done) but change nothing else.
--   - An assignee is told when a task lands on them.
-- (Builds on 20261028180000_club_channels.sql.)

create table if not exists public.campus_club_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.campus_orgs(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  details text not null default '' check (char_length(details) <= 500),
  assignee_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists campus_club_tasks_org_idx on public.campus_club_tasks (org_id, status, due_at);
alter table public.campus_club_tasks enable row level security;

drop policy if exists "club tasks read" on public.campus_club_tasks;
create policy "club tasks read" on public.campus_club_tasks for select to authenticated
using (
  exists (select 1 from public.campus_orgs o where o.id = org_id and o.campus_key = public.my_campus_key())
  and (public.is_org_member(org_id) or assignee_id = auth.uid())
);
drop policy if exists "club tasks create" on public.campus_club_tasks;
create policy "club tasks create" on public.campus_club_tasks for insert to authenticated
with check (created_by = auth.uid() and public.club_open(org_id) and public.has_org_perm(org_id, 'tasks'));
drop policy if exists "club tasks update" on public.campus_club_tasks;
create policy "club tasks update" on public.campus_club_tasks for update to authenticated
using (public.has_org_perm(org_id, 'tasks') or assignee_id = auth.uid())
with check (public.has_org_perm(org_id, 'tasks') or assignee_id = auth.uid());
drop policy if exists "club tasks delete" on public.campus_club_tasks;
create policy "club tasks delete" on public.campus_club_tasks for delete to authenticated using (public.has_org_perm(org_id, 'tasks'));

-- Rules on every write: an assignee must belong to the club; a plain assignee can change only the status; done stamps the time.
create or replace function public.campus_club_task_before_write()
returns trigger language plpgsql security definer set search_path = public
as $$
declare manager boolean;
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.campus_club_tasks where org_id = new.org_id and status <> 'done') >= 100 then raise exception 'That is a lot of open tasks. Finish or delete some first.'; end if;
    new.status := coalesce(new.status, 'todo');
  else
    manager := public.has_org_perm(old.org_id, 'tasks');
    new.org_id := old.org_id; new.created_by := old.created_by; new.created_at := old.created_at;
    if not manager then
      new.title := old.title; new.details := old.details; new.assignee_id := old.assignee_id; new.due_at := old.due_at;
    end if;
  end if;
  if new.assignee_id is not null and not (
    exists (select 1 from public.campus_club_members c where c.org_id = new.org_id and c.user_id = new.assignee_id and c.status = 'member')
    or exists (select 1 from public.campus_org_members m where m.org_id = new.org_id and m.user_id = new.assignee_id)
  ) then raise exception 'Pick someone who belongs to the club.'; end if;
  if new.status = 'done' then new.done_at := coalesce(case when tg_op = 'UPDATE' and old.status = 'done' then old.done_at end, now()); else new.done_at := null; end if;
  return new;
end $$;
drop trigger if exists campus_club_task_before_write on public.campus_club_tasks;
create trigger campus_club_task_before_write before insert or update on public.campus_club_tasks for each row execute function public.campus_club_task_before_write();

create or replace function public.campus_club_task_after_write()
returns trigger language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs;
begin
  if new.assignee_id is not null and new.assignee_id is distinct from auth.uid() and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    select * into o from public.campus_orgs where id = new.org_id;
    insert into public.notifications (recipient_id, actor_id, kind, body)
    values (new.assignee_id, auth.uid(), 'event', left('New task in ' || o.name || ': ' || new.title, 200));
  end if;
  return null;
end $$;
drop trigger if exists campus_club_task_after_write on public.campus_club_tasks;
create trigger campus_club_task_after_write after insert or update of assignee_id on public.campus_club_tasks for each row execute function public.campus_club_task_after_write();

do $$
begin
  execute 'alter publication supabase_realtime add table public.campus_club_tasks';
exception when duplicate_object then null;
end $$;
