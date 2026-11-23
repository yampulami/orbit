-- Email for what a student missed: the sender function marks each notification it has put in an email, so none is sent twice.
alter table public.notifications add column if not exists emailed_at timestamptz;
create index if not exists notifications_to_email_idx on public.notifications (created_at) where emailed_at is null and read_at is null;
-- Students may mark their own notifications read, but must not be able to change the emailed mark.
revoke update (emailed_at) on public.notifications from authenticated, anon;
