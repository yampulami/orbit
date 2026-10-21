# Moving Orbit's data into Supabase

Today only the feed, the campus membership, group chat, profiles, follows, blocks and reports live in Supabase. Everything else is saved in each person's own browser, so it cannot be shared between students, cannot be seen by a server, and does not follow a student to another device. This plan moves it.

The migration is `supabase/migrations/20261021120000_hangouts_reminders_places_push.sql`. **It has not been run against a database.** I wrote it against your existing migrations and helpers (`my_campus_key()`, `campus_groups`, `campus_group_memberships`, `group_messages`, `student_profiles`, `notifications`), but nothing here could be executed or tested in the session that wrote it, so read it, run it on a copy first, and use the checks below.

## What gets stored

| Table | What it holds | Who can see it |
| --- | --- | --- |
| `student_profiles` (new columns) | Onboarding answers: how long on campus, where you live, interests, streaks on or off, nudge choices, theme, when onboarding finished | Your campus (existing rule). Tighten later if tenure and living should be private. |
| `campuses` | One row per university: name, map center, zoom, official map link, whether a person reviewed it | Your own campus. Changed only with the service role, by the import script. |
| `campus_places` | Map places. `live` ones are on the map, `open` ones are student proposals waiting for votes | Your campus (not rejected ones) |
| `place_votes` | One vote (+1 or -1) per student per place | Your campus |
| `hangouts` | A plan inside a group: title, place, start, length, cancelled or not | **Only members of that group** |
| `hangout_rsvps` | Each member's Yes or No | **Only members of that group** |
| `group_messages.hangout_id` (new column) | Lets a hangout appear as a card in the group chat | Group members (existing rule) |
| `reminders` | A person's reminders | **Only the owner** |
| `user_pins` | Up to 3 pins | **Only the owner** |
| `notifications` (wider allowed kinds) | The existing table also carries hangout and map-vote nudges | Only the recipient (existing rule) |
| `push_subscriptions` | A browser's push address and keys | **Only the owner**. A server with the service role sends. |

## Decisions I made, and why

- **Hangouts are private to their group.** That matches how group chat already works, and it matches how the app behaves now. Your earlier "should it be the whole campus?" question was left open, so this is my default. Making hangouts campus-wide would be a small change to the `hangouts read` policy.
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

## What changes in the app after that

The screens stay the same. Each store in `web/src/lib` swaps browser storage for Supabase calls, in this order:

1. `profile.ts`, plus onboarding saving to `student_profiles` instead of `localStorage`.
2. `hangouts.ts` (groups use the existing tables, hangouts and answers use the new ones), with realtime so a Yes shows up for the group at once.
3. `reminders.ts` and `pins.ts`.
4. `campus.ts` and `placeVotes.ts` read places and votes from the database. The browser file import stays as an offline fallback.
5. Then the push sender (see `web/README.md`, Notifications): it can finally see what is due.

Keep the demo mode working through all of this: when there is no Supabase project, the stores keep using browser storage, exactly as now.
