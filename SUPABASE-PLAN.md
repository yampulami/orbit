# Moving Orbit's data into Supabase

Today only the feed, the campus membership, group chat, profiles, follows, blocks and reports live in Supabase. Everything else is saved in each person's own browser, so it cannot be shared between students, cannot be seen by a server, and does not follow a student to another device. This plan moves it.

The migration is `supabase/migrations/20261021120000_hangouts_reminders_places_push.sql`. Its tables are named `campus_hangouts` and `campus_hangout_rsvps` (not `hangouts`) because the project it is meant for already contains an older Orbit schema with its own `hangouts` table, which this must not touch. **It was applied on 2026-10-21 to the project in `web/.env.local` (`ywhoyolsbgjqgkfziyin`)**, first as a dry run inside `begin; … rollback;` (it succeeded and left nothing behind), then for real. After that, all 8 new tables had row-level security on, 25 policies, 6 triggers and 7 new profile columns existed, and the 6 existing users were untouched. Caldwell University and its 11 places were loaded as live. The checks below were run on 2026-10-22 as real test users and all gave the expected result (see "Check results").

A second project (`smuilaiwgzbnqbkaawne`) holds an older schema (friend groups, spaces, tasks, expenses, with its own `hangouts` and `is_group_member`). Nothing in this plan touches it.

## Status, as of 2026-10-21

Applied to the project in `web/.env.local` (`ywhoyolsbgjqgkfziyin`), each first as a dry run inside `begin; … rollback;`:

1. `20261021120000_hangouts_reminders_places_push.sql`: hangouts and answers, reminders, pins, map places and votes, onboarding columns, push subscriptions. Caldwell and its 11 places were loaded.
2. `20261021180000_private_groups_invite_codes.sql`: groups are private and joined with an invite code.

**Switched to the database, and tested end to end with two real guest accounts:**
- Onboarding answers (`student_profiles`). Restored on a new device, and nudge changes in Profile reach the database.
- Groups, group chat, hangouts and Yes/No answers. A made a group and got a code; B could see nothing until B entered the code, then saw the group, the message and the hangout, answered, and the database showed both answers. A message sent in one tab appeared in another without a reload.

- Reminders and pins (`reminders`, `user_pins`): added, marked done, deleted and undone, all saved to the account. After a reload nothing is kept on the device, and everything came back from the database. They refresh when you return to the tab, not live.

**Map places and votes** now live in `campus_places` and `place_votes`. Checked live with three guest accounts: one added a place, the second and third confirmed it from the map, and the database moved it from `open` to `live` at the third yes.

**Roommate households** (migration `20261022100000_households.sql`, applied 2026-10-22) are a private group plus `households`, `household_tasks`, `household_groceries`, `household_expenses` and `household_notes`, all readable and editable by the group's members only. Roommates join with the group's invite code. Checked live with two guest accounts: the second saw nothing before joining, then saw the first one's chore and grocery, and an expense it added was split between both. **Push** (`20261022110000_push_sender.sql`, applied) adds `reminders.due_at` and `push_sent`; the sender and the four steps you do are in `PUSH-SETUP.md`.

**Nothing is device-only any more** except each person's theme, last-seen markers and similar small preferences.

**How groups work now:** a student makes a group and gets a 10-character code (and a link, `/join/CODE`). Only members can see the group, its members and its code. Nobody can add themselves directly; they must know the code. The person who made the group can replace the code. Two groups may share a name.

## What gets stored

| Table | What it holds | Who can see it |
| --- | --- | --- |
| `student_profiles` (new columns) | Onboarding answers: how long on campus, where you live, interests, streaks on or off, nudge choices, theme, when onboarding finished | Your campus (existing rule). Tighten later if tenure and living should be private. |
| `campuses` | One row per university: name, map center, zoom, official map link, whether a person reviewed it | Your own campus. Changed only with the service role, by the import script. |
| `campus_places` | Map places. `live` ones are on the map, `open` ones are student proposals waiting for votes | Your campus (not rejected ones) |
| `place_votes` | One vote (+1 or -1) per student per place | Your campus |
| `campus_hangouts` | A plan: title, place, start, length, cancelled or not, and `visibility` | **Group members only** by default. A hangout marked `campus` (public, like an event) is visible and answerable by the whole campus and may have no group. |
| `campus_hangout_rsvps` | Each person's Yes or No | Whoever can see the hangout |
| `group_messages.hangout_id` (new column) | Lets a hangout appear as a card in the group chat | Group members (existing rule) |
| `reminders` | A person's reminders | **Only the owner** |
| `user_pins` | Up to 3 pins | **Only the owner** |
| `notifications` (wider allowed kinds) | The existing table also carries hangout and map-vote nudges | Only the recipient (existing rule) |
| `push_subscriptions` | A browser's push address and keys | **Only the owner**. A server with the service role sends. |

## Decisions I made, and why

- **Hangouts are private to their group, unless marked public.** That was your call. A public hangout (`visibility = 'campus'`) is open to the whole campus and can be planned without a group, like a small event. Answers on a public hangout are visible to the campus, so the app should show counts and the people the viewer follows, not an open list of everyone.
- **The rules live in the database, not only in the app.** Anything a student's browser could skip is also enforced here:
  - a place goes live at 3 or more confirmations with at least 70% agreeing, and is dropped at 3 or more "not right" that lead,
  - you cannot vote on your own proposal, and only on open proposals in your own campus,
  - 5 proposals a day, and the same name within about 60 meters is refused as a duplicate,
  - a hangout that overlaps one you organize or said Yes to is refused,
  - 3 pins at most,
  - the organizer's Yes is added automatically.
- **Nothing is hard-deleted from the app.** A hangout is cancelled by setting `canceled_at`, so Undo keeps working. Reminders are the exception: students may delete their own.
- **Votes are equal for now.** Tenure-weighted votes (the idea of counting long-time students a little more) need the onboarding answers to be in the database first. This migration stores them, so it can be added next.
- **Roommates (chores, groceries, expenses, notes) are not in this migration.** They are a bigger, separate piece, and the household needs its own membership rules. Do them after hangouts and reminders are working.

## Applying it

1. **Copy first.** Try it on a copy of the project (a Supabase branch or a second project), not your live one.
2. **Apply.** Paste the migration into the Supabase SQL editor, or run `supabase db push` if you use the CLI. It is written to be re-runnable (`if not exists`, `drop policy if exists`).
3. **Load a campus.** For each campus file in `web/src/data/campuses/`:
   ```bash
   node web/scripts/campus-sql.mjs caldwell-university
   ```
   Paste the output into the SQL editor. It loads the campus and its places as live, and running it again updates instead of duplicating. Montclair State is an unreviewed draft, so review it before loading.
4. **Turn on guest sign-in if you want it:** Authentication, Sign In / Providers, Anonymous sign-ins.

## Checks to run (in the SQL editor, as two different test users)

Replace the UUIDs with real user ids from `auth.users`. Each check should end with the result shown.

```sql
-- Act as a student (repeat with a second user to compare)
select set_config('request.jwt.claims', '{"sub":"<USER_ID>","role":"authenticated"}', true);
set local role authenticated;
```

| Check | Expect |
| --- | --- |
| Read `campus_places` as a student of another campus | no rows from this campus |
| Insert a place with `status = 'live'` | refused by the policy |
| Insert a place, then insert it again within a few meters with the same name | second one raises "That place is already on the map." |
| Add 6 places in a day | the 6th raises "You can add up to 5 places a day." |
| Vote on your own place | refused |
| Three other students vote +1 on an open place | its `status` becomes `live` |
| Read `hangouts` as someone who is not in the group | no rows |
| Answer a hangout you cannot see | refused |
| Plan a hangout that overlaps one you are going to | raises "You already have plans then." |
| Insert a 4th pin | raises "You can pin up to 3 things." |
| Read another student's `reminders` or `push_subscriptions` | no rows |

If a check does not give that result, the policy or trigger named in the migration is the place to look. Report it and I will fix the migration.

## Check results (2026-10-22)

Run in the SQL editor by acting as three Caldwell test users (Taylor, Riley, Casey) inside one transaction that was rolled back, so nothing was kept. Other-campus access was checked by moving Casey to another campus inside that same rolled-back transaction, because no real student from another campus exists yet.

| Check | Result |
| --- | --- |
| Another campus reads Caldwell places, votes, hangouts, household chores, groups, profiles | 0 rows each |
| Another campus adds a Caldwell place | refused by the policy |
| Insert a place as `live` | refused by the policy |
| Same name within a few meters | "That place is already on the map." |
| Daily limit | 3 more accepted on top of 2 already that day, then "You can add up to 5 places a day." |
| Change the vote on your own place | refused, no vote changed |
| Three students vote +1 | status became `live` |
| Group hangout read by a member / a non-member | 1 row / 0 rows |
| Answer a hangout you cannot see | refused by the policy |
| Overlapping hangout | "You already have plans then." |
| Pins | 2 more accepted on top of 1 already, then "You can pin up to 3 things." |
| Household chores read by a member / a non-member | 1 row / 0 rows |
| Add a chore to a household you are not in | refused by the policy |
| Give a chore to someone outside the household | "That person is not in this household." |
| Read another student's reminders and push addresses | 0 rows each |
| Read `push_sent` as a student | 0 rows |

## What changes in the app after that

The screens stay the same. Each store in `web/src/lib` swaps browser storage for Supabase calls, in this order:

1. `profile.ts`, plus onboarding saving to `student_profiles` instead of `localStorage`.
2. `hangouts.ts` (groups use the existing tables, hangouts and answers use the new ones), with realtime so a Yes shows up for the group at once.
3. `reminders.ts` and `pins.ts`.
4. `campus.ts` and `placeVotes.ts` read places and votes from the database. The browser file import stays as an offline fallback.
5. Then the push sender (see `web/README.md`, Notifications): it can finally see what is due.

Keep the demo mode working through all of this: when there is no Supabase project, the stores keep using browser storage, exactly as now.

## Housekeeping: guest accounts and the "connections" number

**What the connections number is.** The dashboard's "23 / 60 connections" counts open links between Supabase's own services and the Postgres database. It is not a count of users or sign-ins. A guest does not hold a connection; thousands of people share the same small pool, and the number follows how much work the servers are doing at once, not how many accounts exist. Most of the 23 is Supabase's own services (the data API, sign-in, realtime, storage) plus background workers: turning on `pg_cron` and `pg_net` each add one, and every open SQL editor tab adds one. To see exactly what holds them, run:

```sql
select coalesce(nullif(application_name, ''), '(none)') as who, state, count(*)
from pg_stat_activity
where datname = current_database()
group by 1, 2
order by 3 desc;
```

**What guests do cost.** Each guest is a row in `auth.users` plus whatever they made. That is storage clutter, and it counts toward the monthly active user limit while they are active, but it is not a connection. Anonymous sign-ins are also rate limited by Supabase (by default 30 per hour per IP address), which is the limit a lot of quick test sign-ins would actually hit.

**What the app does about it now** (`20261022120000_delete_my_account.sql`, which has to be applied):
- **Sign out as a guest deletes the guest.** A guest has no password and cannot come back to the account, so leaving removes it and everything it made.
- **Profile has "Delete my account"** for everyone, with a confirmation. A group the person started stays with the friends still in it (it is handed to the longest-standing other member); everything else they made is removed.

**Optional: clear out guests who just closed the tab.** Guests who never signed out are not removed by the above. This removes anonymous accounts that are over 3 days old. It is not switched on, because it permanently deletes accounts. Run it by hand when you want, or schedule it:

```sql
-- preview first
select count(*) from auth.users where is_anonymous and created_at < now() - interval '3 days';
-- then, when you are happy with the count
delete from auth.users where is_anonymous and created_at < now() - interval '3 days';
```
