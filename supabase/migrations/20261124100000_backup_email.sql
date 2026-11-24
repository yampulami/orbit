-- A second, personal email for the account, so it survives the school deleting the student's school address.
-- It lives in its own table, not on the profile, because profiles can be read by classmates and this must never be.

create table if not exists public.private_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  backup_email text not null check (backup_email = lower(backup_email) and char_length(backup_email) <= 254),
  verified_at timestamptz not null default now()
);
-- one person per address, so sign-in by that address is never ambiguous
create unique index if not exists private_contacts_email_idx on public.private_contacts (backup_email);
alter table public.private_contacts enable row level security;
drop policy if exists "private contacts own read" on public.private_contacts;
create policy "private contacts own read" on public.private_contacts for select to authenticated using (user_id = auth.uid());
-- no insert, update or delete policy: only the backup-email function (service role) writes here

-- Codes sent to a personal address (to confirm it, or to reset a password through it). Only a hash is kept. Nobody but the function can read this.
create table if not exists public.email_codes (
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('verify')),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  primary key (user_id, purpose)
);
alter table public.email_codes enable row level security;
