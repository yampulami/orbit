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

## Any school: verify from your own school's website (no setup per school)

The directory reader above needs a row per school and a directory in Caldwell's layout. For every other school a coordinator proves themselves.

**Where they go.** Campus tab, bottom of the page: "Run student life at your school? Verify your staff role." It opens a sheet that explains three steps in plain words.

**What they do.**
1. Be signed in with their school email (a personal address is refused with an explanation).
2. Copy the link to their page on their school's website: their staff directory entry, or their office's page. It must show their name, title and school email.
3. Paste it and press Verify. The page is read on the spot (`verify-staff-claim`).

**What the check requires, all of it** (`supabase/functions/_shared/staffClaim.ts`, tested in `web/src/lib/staffClaim.test.ts`):
- the email on the account is **confirmed** (they own the mailbox) and is a school address;
- the page is on that school's own main website (the email's domain, `www`, or the school's main domain), not a news, blog, events or student page, and every redirect is checked too;
- their exact email address is on the page, in an entry that names nobody else's address;
- the entry's title carries authority (Dean 90, Director 85, Associate Dean 75, Assistant Director 60 ...) and the entry mentions a student-life office (student life, student affairs, student engagement, student activities, dean of students and similar);
- the page looks like a directory (several other addresses on the same domain) or an office or staff page.

Score 80 or more gives **coordinator**, 60 to 79 **staff**. A campus gets at most 3 coordinators and 12 staff this way; further ones need an existing coordinator to approve. Five tries an hour.

**If the page does not prove it.** They see exactly why ("We found you, but 'Administrative Assistant' is not a leadership title") and can press "Ask a coordinator to decide". The request goes to the campus's coordinators (bell notification and the Review tab). If a campus has no coordinator yet there is nobody to ask: they try another page, or you decide it from the SQL editor with `select public.decide_staff_claim('<claim id>', true, 'coordinator');`.

**After it works.** The person is told, the campus's other coordinators are told, and their real title is the label on events they post. Coordinators have a **Staff team** list in the Review tab showing who has access and how they got it (by hand, from the directory, verified from the website) with a Remove button (not for yourself, never for the last coordinator) and the waiting requests with Approve and Decline. Every attempt, denied ones included, is kept in `staff_claims`.

**What it cannot prove.** A page on the school's main website that lists someone's email with a leadership title is accepted as the school's word. If a school lets students edit pages on its main site, that could be abused; coordinators are notified of every grant and can remove access.
