# Campus events

Big public events for the whole campus, put on by **organizations** (a club, a department, an office) or by staff directly. Groups stay for small private hangouts.

## Events versus hangouts (how students tell them apart)

| | Where | Who sees it | Who makes it | Label |
|---|---|---|---|---|
| **Group hangout** | Groups | Only the people in that group (or "open to campus" if the group chose) | Any student | "Group hangout" |
| **Student event** | Plans, Home, bell | Everyone on the campus | An officer of an approved student club | "Student event" (green) |
| **Official campus event** | Plans, Home, bell | Everyone on the campus | Staff, a coordinator, or an officer of an official office | "Official campus event" (violet) |

In the app: Plans has a "Campus events" section with a "What is the difference between events and hangouts?" explainer, the week board has a colour key (group hangout, campus event, class, reminder), hangout cards say "Group hangout", and the Groups plan form says a hangout is not an official event.

## Organizations (the better way to approve)

Instead of approving every event, a coordinator approves the **organization once**. After that its officers post events as the organization and they go live at once.

1. **A student asks.** In Plans, "Host events for a club or office", then "Ask to host events for a club": a name and a line about it. It goes to the coordinators ("Club waiting for approval" in their bell and in a box in Plans). The student becomes the organization's **owner**.
2. **A coordinator approves or declines** (with a short reason). On approval the owner is told, and they can post events as the club. A coordinator or staff host who sets up an organization makes it active at once.
3. **The owner adds officers** by username ("Add an officer"). Officers can post for the club. An owner can remove officers; the last owner cannot leave.
4. **Posting.** "Post an event" asks who to post as when there is a choice. Posts as a student club are labelled "Student event"; posts as an official office are labelled "Official campus event".
5. **Pause.** A coordinator can pause an organization (it cannot post while paused) and resume it later.

Staff and coordinators (people in `campus_hosts` with role `staff` or `coordinator`) can also post Official events directly as themselves, and approve organizations and moderate events. Student hosts in `campus_hosts` (role `student`) still work the old way, where each event waits for approval, but organizations are the recommended route.

## Moderation

- **Report.** Any student can report an event ("Report" on the card, with an optional reason). Coordinators are told the first time, and see it under "Reported events".
- **Remove.** A coordinator can **Remove** an event (it is hidden from students; the host sees "Removed by a coordinator") or choose "It is fine" to clear the reports. A removed event can be brought back.
- Hosts can cancel their own events; people who said Going or Interested are told.

## Turn it on

1. In the Supabase SQL editor run `supabase/migrations/20261027100000_campus_events.sql`, then `supabase/migrations/20261027140000_campus_orgs.sql`. (Until they are run, the sections just show nothing and the app keeps working.)
2. Make someone a coordinator or staff host (find their account id in Authentication, Users):

```sql
insert into campus_hosts (user_id, campus_key, label, role)
values ('THEIR-USER-ID', 'caldwell-university', 'University Library', 'staff');
```

`role` is `coordinator` or `staff` (can approve and moderate), or `student` (old style, each event waits). `label` is what students see on events they post personally. To remove a host: `delete from campus_hosts where user_id = '...';`.

Nobody can add themselves as a host, and nobody can approve their own organization: the database decides who is a reviewer.

## What the database enforces (not just the app)

- Students only see events and active organizations on their own campus. Waiting, paused, declined or removed things are visible only to their owners and to reviewers.
- The kind (official or student) and status (live or waiting) are set by the database from the organization or the host's role. The app cannot choose them.
- Only a reviewer can approve or decline an organization or an event, remove an event, or pause an organization. An owner can only change the description.
- Only an officer of an active organization can post as it. A host can post at most 10 events a day; a student can ask for at most 3 organizations a day.
- Going and Interested are only allowed on live events, and only the person who gave an answer can change it. Reports can only be read by reviewers.
- All notifications are written by the database, so nobody can send them by hand.

## How events can get in (the options)

1. **An officer or staff member posts it in the app (built).** Safest: a person you chose, signed in, posting what they mean to post. Nothing outside reads anything.
2. **Organizations and approval (built).** Clubs ask once; coordinators approve once.
3. **Public calendar links (a good next step).** Many departments publish a calendar link (an `.ics` or RSS address from Google Calendar, Outlook or the school's events system). Orbit can read only the specific links you register, with no password and no mailbox access, tied to an organization.
4. **Forward to Orbit (also reasonable).** An officer forwards an event email to one Orbit address. Orbit only sees what was sent to it, checks the sender and SPF and DKIM, and puts a draft in front of the officer to approve.
5. **Reading someone's mailbox (not recommended).** It exposes every other message in that inbox, and a leaked key would expose all of it.

## Later

- Invite codes so a dean or an office can be set up without SQL.
- School sign-in (Microsoft or Google), so staff and student roles come from the university's own records. That needs a university partner.
