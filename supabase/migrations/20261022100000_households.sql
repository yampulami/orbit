-- Roommate households: chores, groceries, expenses and house notes shared by the members of one private group.
-- A household is a friend group (so it has a chat and an invite code) that is also listed in `households`.
-- Everything below is readable and editable by the members of that group, and by nobody else.

create table if not exists public.households (
  group_id uuid primary key references public.campus_groups(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.households(group_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  assignee uuid references auth.users(id) on delete set null,
  points smallint not null default 2 check (points in (1, 2, 3, 5)),
  done boolean not null default false,
  done_at timestamptz,
  due_on date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.household_groceries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.households(group_id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  category text not null default 'Other' check (char_length(category) between 1 and 40),
  bought boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.household_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.households(group_id) on delete cascade,
  item text not null check (char_length(btrim(item)) between 1 and 80),
  cents integer not null check (cents > 0 and cents < 100000000),
  paid_by uuid references auth.users(id) on delete set null,
  split uuid[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.household_notes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.households(group_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null default '' check (char_length(body) <= 2000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists household_tasks_group_idx on public.household_tasks(group_id, created_at desc);
create index if not exists household_groceries_group_idx on public.household_groceries(group_id, created_at);
create index if not exists household_expenses_group_idx on public.household_expenses(group_id, created_at desc);
create index if not exists household_notes_group_idx on public.household_notes(group_id, created_at desc);

alter table public.households enable row level security;
alter table public.household_tasks enable row level security;
alter table public.household_groceries enable row level security;
alter table public.household_expenses enable row level security;
alter table public.household_notes enable row level security;

-- Members only. `is_campus_group_member` already checks the signed-in student's own membership rows.
drop policy if exists "household members read" on public.households;
create policy "household members read" on public.households for select to authenticated
using (public.is_campus_group_member(group_id));

do $$
declare t text;
begin
  foreach t in array array['household_tasks', 'household_groceries', 'household_expenses', 'household_notes'] loop
    execute format('drop policy if exists "household members read" on public.%I', t);
    execute format('create policy "household members read" on public.%I for select to authenticated using (public.is_campus_group_member(group_id))', t);
    execute format('drop policy if exists "household members add" on public.%I', t);
    execute format('create policy "household members add" on public.%I for insert to authenticated with check (public.is_campus_group_member(group_id) and created_by = auth.uid())', t);
    execute format('drop policy if exists "household members change" on public.%I', t);
    execute format('create policy "household members change" on public.%I for update to authenticated using (public.is_campus_group_member(group_id)) with check (public.is_campus_group_member(group_id))', t);
    execute format('drop policy if exists "household members remove" on public.%I', t);
    execute format('create policy "household members remove" on public.%I for delete to authenticated using (public.is_campus_group_member(group_id))', t);
  end loop;
end $$;

-- A chore can only go to, and an expense can only be paid by or split with, people who are in the household.
create or replace function public.household_people_check()
returns trigger language plpgsql security definer set search_path = public
as $$
declare p uuid;
begin
  if tg_table_name = 'household_tasks' then
    if new.assignee is not null and not exists (select 1 from public.campus_group_memberships m where m.group_id = new.group_id and m.user_id = new.assignee) then
      raise exception 'That person is not in this household.' using errcode = 'P0001';
    end if;
  else
    if new.paid_by is not null and not exists (select 1 from public.campus_group_memberships m where m.group_id = new.group_id and m.user_id = new.paid_by) then
      raise exception 'That person is not in this household.' using errcode = 'P0001';
    end if;
    foreach p in array new.split loop
      if not exists (select 1 from public.campus_group_memberships m where m.group_id = new.group_id and m.user_id = p) then
        raise exception 'Someone in the split is not in this household.' using errcode = 'P0001';
      end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists household_tasks_people on public.household_tasks;
create trigger household_tasks_people before insert or update on public.household_tasks for each row execute function public.household_people_check();
drop trigger if exists household_expenses_people on public.household_expenses;
create trigger household_expenses_people before insert or update on public.household_expenses for each row execute function public.household_people_check();

-- Makes a household: a private group (you are its first member, with an invite code) that is also marked as a household.
create or replace function public.create_household(gid uuid, gname text)
returns text language plpgsql security definer set search_path = public
as $$
declare c text;
begin
  c := public.create_friend_group(gid, gname);
  insert into public.households (group_id) values (gid);
  return c;
end $$;
revoke all on function public.create_household(uuid, text) from public;
grant execute on function public.create_household(uuid, text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['households', 'household_tasks', 'household_groceries', 'household_expenses', 'household_notes'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
