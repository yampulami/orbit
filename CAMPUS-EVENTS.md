# Campus events

Big public events for the whole campus, put on by **organizations** (a club, a department, an office) or by staff directly. Groups stay for small private hangouts.

## Events versus hangouts (how students tell them apart)

| | Where | Who sees it | Who makes it | Label |
|---|---|---|---|---|
| **Group hangout** | Groups | Only the people in that group (or "open to campus" if the group chose) | Any student | "Group hangout" |
| **Student event** | Plans, Home, bell | Everyone on the campus | An officer of an approved student club | "Student event" (green) |
| **Official campus event** | Plans, Home, bell | Everyone on the campus | Staff, a coordinator, or an officer of an official office | "Official campus event" (violet) |

In the app: Plans has a "Campus events" section with a "What is the difference between events and hangouts?" explainer, the week board has a colour key (group hangout, campus event, class, reminder), hangout cards say "Group hangout", and the Groups plan form says a hangout is not an official event.

## Campus tab: clubs first, events inside them

Events and clubs live in their own **Campus** tab (not in Plans), with three sections: **Events** (what is coming up, public), **Clubs** (every club and office, plus "Create a club"), and **Review** (coordinators only).

1. **Create the club first.** Anyone taps Clubs, then "Create a club" (name and a line about it). The club is saved as waiting and its page opens. The creator is the **owner** and can add officers by username while waiting.
2. **A coordinator approves the club** (or declines with a reason) from Review or from the club's page. A club made by a coordinator or staff is active at once.
3. **Events are posted inside the club.** The club's page has "Post an event" once the club is active. New events from a student club **wait for a coordinator**, unless the coordinator marks the club **Trusted**, after which they go live at once. Official offices always go live at once.
4. **Pause.** A coordinator can pause a club (no new events) and resume it.
5. Staff and coordinators can still post Official events as themselves from the Events section.

The club's officers see their club's waiting events; everyone else sees only live ones. Migration `20261027180000_org_trust.sql` adds the `trusted` switch and the matching database rules.

## Applications and joining (migration 20261027200000_club_applications.sql)

- **Starting a club is an application.** Students fill in what the club is for, category, a faculty or staff adviser (name and email), where and when it meets, expected size, a first event idea and a contact. The database refuses an application without the required parts. Coordinators and staff set clubs up directly.
- **Coordinators get a live board** (Campus, Review, Club applications): Waiting, Approved and Declined, with the full application on each card. New applications appear as they are sent, and coordinators are also notified in the bell.
- **Joining a club needs an officer.** A student taps "Ask to join" (with an optional line), the club's officers see it under "Join requests" and let them in or decline, and the student is notified. Coordinators can answer too. Members are listed to the campus; waiting and declined requests are private to the student, the officers and coordinators.

## Roles, the club feed and Student Circles (migration 20261028100000_club_roles_feed.sql)

- **Roles with titles.** The president (owner) makes roles such as Treasurer or Event lead and ticks what each can do: post announcements, create events, run polls, manage members, manage roles, moderate (tasks are reserved for later). Only the president can hand out "manage roles". A role can also be title-only. Officers from before roles existed keep announcements, events and polls. Deleting a role needs its people moved first. The database enforces all of this (functions `org_perms` and `has_org_perm`), not just the buttons.
- **The club feed.** Announcements are public to the campus and notify the club. Discussion posts, polls and replies are for the club's own people. Votes are anonymous (you can read only your own vote; totals come from `club_poll_results`). Officers with the right role can pin and remove posts.
- **Student Circles.** A casual, unofficial group anyone can start. It is active at once, has no verified badge, anyone can join without approval, it has its own feed, polls and roles, and it cannot post campus events (the database refuses). Clubs and offices keep the application and approval path.
- **Activity.** A badge says Active, Steady, Quiet or New from real activity: upcoming or recent events and the latest post, not from popularity.
- **Co-hosted events (migration 20261028140000_event_cohosts.sql).** When posting an event, the host picks up to three other clubs (not circles) to co-host. Each club's team (people whose role includes creating events) is notified and accepts or declines from a "Co-host invitations" box on Campus and on their club page. Once accepted, the event reads "by A and B" and shows on both club pages, and both memberships see it. The host can withdraw an invitation; a co-host club can step away. Approval and removal stay with the one shared event, and a club that was invited can see the event even while it waits for approval.
- **Club chat channels (migration 20261028180000_club_channels.sql).** Every running club or circle gets a #general. People with the new "Manage channels" permission (and the president) add more channels, including team-only ones that only the president and people with a role can see, and can delete any channel except #general. Only the club's own people can read and write; the database enforces it (`can_read_channel`). Messages arrive live, unread counts come from a per-person read marker, anyone can delete their own message, and people who can moderate can delete others'. Sending is limited to 30 messages a minute.
- **Tasks and the team dashboard (migration 20261028220000_club_tasks.sql).** The team gets a private Dashboard tab: what needs attention (people waiting to join, events waiting for a coordinator, overdue tasks), what is coming up, and a task board (To do, Doing, Done). People whose role includes "Assign tasks" (and the president) add, assign, edit and delete tasks; tasks can go to anyone in the club, and the person is notified. A member sees only the tasks assigned to them (a "Your tasks" box on the club feed) and can move those along, but cannot change anything else; the database enforces this, and finishing a task stamps the time.
- **QR check-in (migration 20261029100000_event_checkin.sql).** The people running an event (its host, an officer allowed to create events for the host or an accepted co-host club, or a coordinator) open "Check-in" on the event card: a QR code that changes every 30 seconds with six letters under it. Students scan it (the link checks them in) or type the letters, from an hour before the event until an hour after it ends. The code is made from a secret kept in a table no screen can read, and checked by the database. Hosts see who has checked in, can check someone in by hand (for accessibility or a dead phone) and undo one. Students keep a private "Events you attended" list on the Campus page.
- **Pods (migration 20261029140000_club_pods.sql).** Small interest groups inside a club (Portrait, Film, Street). The president and people who manage channels create and delete pods; anyone in the club joins or leaves at once. Each pod gets its own private chat channel, read by the pod's members and the club's team. Pods are in the People tab. Pod meetups and pod-only posts are not built yet.
- **Next phases (not built yet).** Pod meetups, club activity summaries, Schedule Sync for club meeting times.

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
