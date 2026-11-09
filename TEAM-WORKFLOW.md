# Working as a team on Orbit

The rule: **nobody but the owner can change what real students see.** Everyone else works on a branch, against a separate dev database, and opens a pull request. The owner reads it, looks at the preview, and approves or asks for changes. Merging to `main` is what puts it live.

```
teammate: branch -> code + tests -> dev database -> pull request
automatic: Checks run (types, tests, build) + a Vercel preview of the branch
owner: reads the diff, tries the preview, approves  ->  merge  ->  live site updates
owner, only if the change has a migration: runs it on the live database
```

## The three pieces

| Piece | Teammates can | Only the owner can |
|---|---|---|
| **Code** (GitHub) | make branches, push them, open pull requests | merge into `main` |
| **Database** (Supabase) | use and change the **dev** project | touch the **live** project |
| **Website** (Vercel) | see a preview of their branch | publish to the live address |

## One-time setup, by the owner

### 1. GitHub: let them in, and lock `main`
1. Repo **Settings, Collaborators, Add people**: add the three teammates with the **Write** role (not Admin).
2. Repo **Settings, Rules, Rulesets, New branch ruleset**, named `Protect main`, enforcement **Active**, target branch **Default**. Switch on:
   - **Require a pull request before merging**, with **1 approval**, **Require review from Code Owners**, and **Dismiss stale approvals when new commits are pushed**
   - **Require status checks to pass**: add the check named `Typecheck, tests and build` (it appears after the first pull request runs)
   - **Block force pushes** and **Restrict deletions**
3. Leave **Bypass list** empty, or add only yourself if you want an emergency exit.
4. The file `.github/CODEOWNERS` already names you for every file, so your approval is required on everything, and `supabase/` (the database) is named on its own line.

GitHub does not let someone approve their own pull request, so a teammate's change always needs you.

### 2. Supabase: a separate dev database
Teammates must never hold keys to the live database.
1. In Supabase make a **new organization** called "Orbit Dev" and a project in it called `orbit-dev` (the free plan allows two projects: live plus dev).
2. Run every file in `supabase/migrations/`, oldest first, in the dev project's SQL editor. (Or ask for a script that does it.)
3. Invite the teammates to the **Orbit Dev** organization as **Developer**. Do **not** add them to your live organization: on the free and Pro plans everyone in an organization can see all of its projects.
4. Dev needs its own secrets for any edge function a teammate works on (`supabase secrets set ... --project-ref <dev ref>`). They never get the live ones.

### 3. Vercel: previews use the dev database
1. In Vercel project **Settings, Environment Variables**, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` **twice**: for **Production** (the live project) and for **Preview** (the dev project). Tick only the matching environment on each.
2. Every branch and pull request then gets its own preview address, running against dev data.
3. Vercel's free Hobby plan is for one person, so it may ask you to **authorise** a teammate's preview before it builds. That is the same approval step. If it blocks one, the teammate can still run the branch on their own computer (below).

## A teammate's first day
1. Accept the GitHub invite, then: `git clone https://github.com/yampulami/orbit.git`
2. `cd orbit/web`, then `npm install`
3. Copy `web/.env.example` to `web/.env.local` and fill in the **dev** project's URL and publishable key (the owner sends these, never the live ones).
4. `npm run dev`, or `set VITE_DEMO=1` first to run with no database at all.

## Every change
1. **Update, then branch:** `git checkout main`, `git pull`, `git checkout -b name/what-it-does` (for example `sam/fix-chat-scroll`).
2. **Work in small steps** and commit often. One idea per branch.
3. **Test:** in `web/`, run `npx tsc --noEmit -p .`, `npx vitest run`, and `npm run build`.
4. **Database change?** Add a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_what_it_does.sql`. Never edit an old one. Run it on the **dev** database. Write it so running it twice is harmless.
5. **Push and open a pull request:** `git push -u origin name/what-it-does`, then on GitHub press **Compare and pull request** and fill in the template.
6. **Wait for the green Checks** and the preview link. Answer the owner's comments by pushing more commits to the same branch.
7. **Never push to `main`**, never use `--force`, never paste a password or key in code or chat.

## The owner's review checklist
- Open the **preview** and use the change, on a phone width too.
- Read the diff. For anything touching `supabase/`, read the SQL line by line: who can read or write what, and does it keep the campus walls (`campus_key`) and the rank rules?
- Look for secrets, `console.log`s, or big unrelated changes.
- Press **Approve**, then **Squash and merge** (one clean commit per change). The live site updates by itself.
- **If there is a migration,** apply it to the live database yourself, after merging: `npx supabase db query --remote=<live ref> -f supabase/migrations/<file>.sql`. Teammates never run anything on live.
- If an edge function changed, redeploy it: `npx supabase functions deploy <name> --no-verify-jwt --remote=<live ref>`.

## If something goes wrong
- **A merged change broke the live site:** on GitHub open the pull request and press **Revert**, then merge that revert. Vercel also keeps old deployments: **Deployments, the last good one, Promote to Production**.
- **A migration broke live data:** do not run anything else. Fix forward with a new migration, and use Supabase backups only as a last resort.

## Rules that keep everyone safe
- No one but the owner has the live Supabase password, service key, Vercel login, or the cron secret.
- The publishable key in `.env` is safe to share (it is public by design). The **service role key** and any `secret` are never shared, never committed.
- Branch names: `yourname/short-description`. Commit messages: what changed and why, in plain words.
