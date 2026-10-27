# Campus events

Big public events for the whole campus, put on by **hosts**: a department, a club, an instructor, the library, student life. Groups stay for small private hangouts.

## Events versus hangouts (how students tell them apart)

| | Where | Who sees it | Who makes it | Label |
|---|---|---|---|---|
| **Group hangout** | Groups | Only the people in that group (or "open to campus" if the group chose) | Any student | "Group hangout" |
| **Student event** | Plans, Home, bell | Everyone on the campus | A student host (club officer), after a staff member approves it | "Student event" (green) |
| **Official campus event** | Plans, Home, bell | Everyone on the campus | Staff or a coordinator, published straight away | "Official campus event" (violet) |

In the app: Plans has a "Campus events" section with a "What is the difference between events and hangouts?" explainer, the week board has a colour key (group hangout, campus event, class, reminder), hangout cards say "Group hangout", and the Groups plan form says a hangout is not an official event.

## Roles

Hosts are stored in `campus_hosts` with a role:

- **coordinator**: the events coordinator (for example someone in Student Life). Posts Official events and approves student events.
- **staff**: a professor, department, library, dean's office. Posts Official events and approves student events.
- **student**: a club officer or similar. Posts Student events, which wait for approval.

Everyone else is a normal student: they see published events and answer Going or Interested.

A dean or professor signs in the same way as anyone (the app has one sign-in). They only get host tools once you give them a role.

## Turn it on

1. In the Supabase SQL editor, run `supabase/migrations/20261027100000_campus_events.sql` once. (Until you do, the app works as before and the events section just shows "No campus events yet".)
2. Add a host. Find their account id (Authentication, Users), then:

```sql
insert into campus_hosts (user_id, campus_key, label, role)
values ('THEIR-USER-ID', 'caldwell-university', 'University Library', 'staff');
```

`label` is what students see ("by University Library"). `role` is `coordinator`, `staff` or `student`. Use the campus key your students have (`campus_memberships.campus_key`). To remove a host: `delete from campus_hosts where user_id = '...';`.

Nobody can add themselves as a host: the table has no insert rule, only you can write to it from the SQL editor.

## How it works

1. A **staff or coordinator** posts: it is published at once as an Official event, and everyone on the campus gets a bell line.
2. A **student host** posts: it is "pending". Only that host and the reviewers can see it. Every coordinator and staff host gets a bell line, "Waiting for approval", and sees it in a "Waiting for your approval" box in Plans.
3. A reviewer taps **Approve**: it is published as a Student event, the campus gets a bell line, and the host is told. Or **Decline** with a short reason: the host is told and can post it again with changes.
4. If a host edits a published student event, it goes back to pending. Staff events can be edited freely.
5. A host can cancel their event; people who said Going or Interested are told.

## What the database enforces (not just the app)

- Students only see events on their own campus, and not from someone they blocked. Waiting and declined events are visible only to their host and to reviewers.
- The kind (official or student) and status (published or pending) are set by the database from the host's role. The app cannot choose them.
- Only a reviewer can approve or decline, and only a waiting event. A reviewer who is not the host cannot edit the event's content.
- A host's name on an event always comes from the hosts list. A host can post at most 10 events a day.
- Going and Interested are only allowed on published events, and only the person who gave an answer can change it.
- All notifications are written by the database, so nobody can send them by hand.

## How events can get in (the options)

1. **A host posts it in the app (built).** Safest: a person you chose, signed in, posting what they mean to post. Nothing outside reads anything.
2. **Approval queue (built).** Student hosts suggest, staff approve.
3. **Public calendar links (a good next step).** Many departments publish a calendar link (an `.ics` or RSS address from Google Calendar, Outlook or the school's events system). Orbit can read only the specific links you register, with no password and no mailbox access, and imported events wait for approval.
4. **Forward to Orbit (also reasonable).** A host forwards an event email to one Orbit address. Orbit only sees what was sent to it, checks the sender is on an allow list and passes SPF and DKIM, and puts a draft in front of the host to approve.
5. **Reading someone's mailbox (not recommended).** It exposes every other message in that inbox, and a leaked key would expose all of it.

## Later

- Invite codes, so a dean can become a host without you typing SQL.
- School sign-in (Microsoft or Google), so staff and student roles come from the university's own records. That needs a university partner.
