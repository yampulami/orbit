# Coordinators and staff from the school's own directory

Nobody has to make a coordinator by hand. A campus's public faculty and staff directory says who the people are and what their titles are; Orbit reads it, finds who runs student life, and gives them their role when they sign up with their school email.

## How it works

1. **Read.** `sync-staff-directory` reads the directory every 6 hours (Caldwell: `caldwell.edu/faculty-staff-directory/`, numbered pages, Name / Department / Title / Email).
2. **Score each title** for authority, 0 to 100. Words before the role count: Dean 90, Director 85, Associate Dean 75, Associate Director 70, Assistant Director 60, Manager 55, Coordinator 45, Administrative Assistant 10, a professor 0. "Assistant Athletic Director" is not a director; "Assistant Vice President, Director of Athletics" counts its strongest part.
3. **Keep the offices that run student life** (words per campus, for Caldwell: student life, student engagement, student affairs, dean of students), matched on the department or the title.
4. **Choose roles.** Score 80 or more: **coordinator** (at most 2). 60 to 79: **staff** (at most 5). Everyone else gets nothing. On the real Caldwell directory (488 people) this picks exactly the Dean of Student Life and the Director of Student Engagement as coordinators and the Associate Dean for Student Life as staff.
5. **Give the role to the right account.** When a signed-in person's email is on the list, **and they have confirmed it** (clicked the sign-up link, so they own the mailbox), the database makes them a host with that role and their real title as the label on events they post. The app asks once after sign-in (`claim_staff_access`); the sync also does it for people who already have accounts.
6. **Take it away again.** If someone disappears from the directory, the role the directory gave them is removed at the next read. A role you gave by hand (`source = 'manual'`, for example Cam) is never changed or removed by the directory. If a read returns nothing, or far fewer people than last time, nobody loses anything.

## What protects it

- The email must be **confirmed** and match the directory **exactly**; `name+tag@caldwell.edu` is a different address and gets nothing.
- The address is read only from the Email column. (A biography in the same row can mention other addresses; a test covers this.)
- Only addresses on the campus's allowed domains count.
- The directory tables have no policies: students cannot read or write them.
- The directory is read-only to Orbit and fetched from public `https` pages only, with a size limit.

## Setting up a new campus

Add one row (SQL editor), then it runs by itself:

```sql
insert into public.campus_directory_sources (campus_key, url, domains, offices)
values ('their-campus-key', 'https://www.theirschool.edu/staff-directory/', array['theirschool.edu'], array['student life', 'student affairs']);
```

The reader expects the layout Caldwell uses (table rows with `data-label="Name"`, `"Department"`, `"Title"`, `"Email"`, numbered pages at `/page/2/`). A school with a different layout needs its page format added to `parseDirectoryPage`; nothing is damaged if it cannot be read, the note on the source row says what happened.

## Limits worth knowing

- It trusts the school's directory. If the directory is wrong, so is the access; the school fixing its directory fixes Orbit within 6 hours.
- If staff and students share one email domain, a student cannot be mistaken for staff because the match is on the exact address from the directory, not the domain.
- Someone newly hired appears after the next read and signs in (or already has an account).
- The setup is in `supabase/migrations/20261103200000_staff_directory.sql`; the scoring is in `supabase/functions/_shared/staffDirectory.ts`, tested in `web/src/lib/staffDirectory.test.ts`.
