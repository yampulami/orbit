# Alerts when Orbit is closed (web push)

Everything is built. Four things need you, because they involve secrets or project settings that I do not touch.

## What is already in the repo

- `web/src/lib/push.ts`: after a student allows device alerts (Profile, or the nudges step of onboarding) this registers their device and saves its address in `push_subscriptions`. Turning alerts off removes it. It does nothing until `VITE_VAPID_PUBLIC_KEY` is set.
- `web/public/sw.js`: shows the alert and opens `/app/plans` when tapped. If Orbit is already open and in view it stays quiet, because the app alerts for itself.
- `supabase/migrations/20261022110000_push_sender.sql`: adds `reminders.due_at` (the exact moment a reminder is due) and `push_sent` (so nothing is pushed twice). Students cannot read or write `push_sent`.
- `supabase/functions/send-due-pushes/index.ts`: finds reminders that just came due and hangouts starting in the next 30 minutes (for the organizer and everyone who said yes), skips people who turned that kind of nudge off, sends the push, and forgets addresses the browser says are gone.

Reminders made before this migration have no `due_at`, so they are never pushed. New and edited ones are.

## What you do

1. **Make a key pair** on your own computer. The private key never goes in the repo or in the app.

   ```bash
   npx web-push generate-vapid-keys
   ```

2. **Public key into the app.** Put the *public* key in `web/.env.local` as `VITE_VAPID_PUBLIC_KEY=...` and in your host's environment settings (for example Vercel), then redeploy.

3. **Secrets and function.** With the Supabase CLI logged in to project `ywhoyolsbgjqgkfziyin`:

   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com PUSH_CRON_SECRET=pick-a-long-random-string
   supabase functions deploy send-due-pushes --no-verify-jwt
   ```

   `--no-verify-jwt` is there because the schedule calls it with its own secret header (`x-cron-secret`), which the function checks itself.

4. **Run it every minute.** In the Supabase dashboard turn on the `pg_cron` and `pg_net` extensions (Database, Extensions), then run this in the SQL editor with your own project URL and the same secret:

   ```sql
   select cron.schedule(
     'send-due-pushes', '* * * * *',
     $$ select net.http_post(
          url := 'https://ywhoyolsbgjqgkfziyin.supabase.co/functions/v1/send-due-pushes',
          headers := '{"x-cron-secret": "pick-a-long-random-string"}'::jsonb
        ) $$
   );
   ```

   To stop it later: `select cron.unschedule('send-due-pushes');`

## Limits worth knowing

- Chrome, Edge and Firefox on desktop and Android work. On iPhone and iPad, the student must add Orbit to the Home Screen first (iOS 16.4 or later). Safari on Mac works from version 16.
- Hangout alerts say "Starts in N min" rather than a clock time, because the server does not know the student's time zone.
- Reminders without a time of day are not pushed.
- A push can arrive up to a minute late, since the schedule runs once a minute.
