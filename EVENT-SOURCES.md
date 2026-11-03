# Events from a club's or office's own website

An organization's owner pastes the address of its events page (Club page, Info, "Events from your website"). Orbit reads it every few hours and keeps the organization's campus events in step with it. Imported events go live at once, labelled with the organization, and end with "More at <address>".

## What it reads

- **A calendar feed** (the public iCal address from Google Calendar or Outlook, an `.ics` file). The dependable choice. Repeating events show once, at their first date.
- **A hand-written page** where every event is a block of `Title`, `Date:`, `Time:`, `Location:`, `Details:` (Caldwell's "The 39" page is this). The reader copes with: no year (the next coming date), a start typed as PM that should be AM (`11:30 PM - 1:30 PM`), a single time, `All day`, `TBD`, a missing location, links inside the details, and `CANCELLED` in the location.

Each event is matched by its title and date (or the feed's own id), so editing the time or place updates it instead of adding a copy.

## What a read does

| On the page | In Orbit |
|---|---|
| a new event | added, published at once, the campus is **not** notified one by one |
| an edited event | updated |
| marked cancelled | cancelled (people who said going are told) |
| removed before it happens | taken down; brought back if it returns |
| nothing found at all | nothing is changed; the club sees "No events found" |

Only `https` addresses of public websites are read, at most 3 MB, following redirects that stay public. The Read-it-now button can be used once every two minutes.

## Setting it up (once)

1. **Migration.** Run `supabase/migrations/20261103140000_event_sources.sql` in the SQL editor. It also gives the "Student Life" official office the Caldwell "The 39" address, if that office exists.
2. **Deploy the function** (Supabase CLI logged in to project `ywhoyolsbgjqgkfziyin`):

   ```bash
   supabase secrets set EVENTS_CRON_SECRET=pick-a-long-random-string
   supabase functions deploy sync-campus-events --no-verify-jwt
   ```

   `--no-verify-jwt` is there because the schedule calls it with its own secret header and the function checks the signed-in person itself when the app calls it.
3. **Run it every 3 hours.** With `pg_cron` and `pg_net` turned on (Database, Extensions):

   ```sql
   select cron.schedule(
     'sync-campus-events', '0 */3 * * *',
     $$ select net.http_post(
          url := 'https://ywhoyolsbgjqgkfziyin.supabase.co/functions/v1/sync-campus-events',
          headers := '{"x-cron-secret": "pick-a-long-random-string"}'::jsonb
        ) $$
   );
   ```

   To stop it: `select cron.unschedule('sync-campus-events');`

## Limits worth knowing

- A hand-written page can only be read while its owners keep writing events the same way. If they change it, the club sees "No events found" and nothing is damaged. A calendar feed has no such problem; ask the office for theirs.
- Flyer pictures are not copied.
- Imported events are published without a coordinator's approval even for a student club, because only the club's owner can set the address. A coordinator can still remove an event or pause the club.
- The parser lives in `supabase/functions/_shared/eventSources.ts` and is tested in `web/src/lib/eventSources.test.ts`.
