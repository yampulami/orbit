-- Remembers which "your event is coming up" emails were sent, so none goes out twice. Only the sender (service role) uses it.
create table if not exists public.email_event_reminders (
  event_id uuid not null references public.campus_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.email_event_reminders enable row level security;
