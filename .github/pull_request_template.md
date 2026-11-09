## What this changes
<!-- One or two sentences, in plain words. What can a student do now, or what was broken? -->

## How to see it
<!-- The Vercel preview link appears below as a comment. Say where to click. A screenshot helps. -->

## Database
- [ ] No database change
- [ ] This adds a file in `supabase/migrations/`, and I ran it on the **dev** database (never the live one)
- [ ] The migration can be run twice without breaking (uses `if not exists`, `create or replace`, or checks first)

## Before asking for review
- [ ] `npx tsc --noEmit -p .`, `npx vitest run` and `npm run build` pass in `web/` (the Checks run does this too)
- [ ] I looked at it on a phone width and a desktop width
- [ ] I did not commit passwords, keys, or `.env` files
