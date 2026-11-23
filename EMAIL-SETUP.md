# Email for missed notifications

What is built: a student who leaves a notification unread for 15 minutes gets one email that gathers everything they missed (at most one email every 3 hours). It is on by default, and each student can turn it off in Profile, Notifications, "Email me what I missed".

- `supabase/migrations/20261123100000_notification_emails.sql` adds `notifications.emailed_at` so nothing is sent twice.
- `supabase/functions/send-notification-emails/index.ts` builds the email and sends it through Resend (the same account that sends the confirmation emails).

## What you do

1. Set the secrets. Use the same Resend key as the confirmation emails; the from-address must be on the verified orbitcampus.org domain.

   ```bash
   supabase secrets set RESEND_API_KEY=... EMAIL_CRON_SECRET=pick-a-long-random-string EMAIL_FROM="Orbit <notifications@orbitcampus.org>"
   supabase functions deploy send-notification-emails --no-verify-jwt
   ```

2. Run it every 10 minutes (Database, Extensions: `pg_cron` and `pg_net`), with your secret:

   ```sql
   select cron.schedule('send-notification-emails', '*/10 * * * *',
     $$ select net.http_post(
          url := 'https://ywhoyolsbgjqgkfziyin.supabase.co/functions/v1/send-notification-emails',
          headers := '{"x-cron-secret": "pick-a-long-random-string"}'::jsonb) $$);
   ```
