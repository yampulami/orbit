-- What the push sender needs to see: the exact moment a reminder is due (the app saves a date and a local time, which a server cannot place on
-- the clock without the student's time zone), and a record of what has already been pushed so nothing is sent twice.

alter table public.reminders add column if not exists due_at timestamptz;
create index if not exists reminders_due_idx on public.reminders(due_at) where done = false and due_at is not null;

create table if not exists public.push_sent (
  kind text not null check (kind in ('reminder', 'hangout')),
  item_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (kind, item_id, user_id)
);
-- No policies on purpose: students cannot read or write this. Only the sender, which uses the service role, does.
alter table public.push_sent enable row level security;
