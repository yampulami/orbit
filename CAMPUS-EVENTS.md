# Campus events

Big public events for the whole campus, put on by **hosts**: a department, a club, an instructor, the library, student life. Groups stay for small private hangouts.

Students see them in **Plans** (a "Campus events" section and blocks on the week board), in a short "Happening on campus" list on Home, and in the bell. Anyone can say **Going** or **Interested**. Only hosts can post or cancel.

## Turn it on

1. In the Supabase SQL editor, run `supabase/migrations/20261027100000_campus_events.sql` once. (Until you do, the app works as before and the events section just shows "No campus events yet".)
2. Make someone a host. Find their account id (Authentication, Users), then run:

```sql
insert into campus_hosts (user_id, campus_key, label)
values ('THEIR-USER-ID', 'caldwell-university', 'University Library');
```

`label` is what students see next to the event. Use the campus key your students have (it is in `campus_memberships.campus_key`). To remove a host: `delete from campus_hosts where user_id = '...';`.

Nobody can add themselves as a host: the table has no insert rule, only you can write to it from the SQL editor.

## What the database enforces

- Students only see events on their own campus, and not from someone they blocked.
- Only people in `campus_hosts` can post, as themselves, with the name from that list (the host cannot change it). A host can post at most 10 events a day.
- Everyone on the campus gets a bell line when an event is posted. People who said going or interested get one if it is cancelled. The database writes these, so nobody can send notifications by hand.
- Answers (going or interested) can only be changed by the person who gave them.

## How events can get in (the options)

1. **A host posts it in the app (built).** The safest: a person you chose, signed in, posting what they mean to post. Nothing outside reads anything.
2. **Reading the library's mailbox (not recommended).** It needs permission to read an inbox, which exposes every other message in it, and a leaked key would expose that mail. If it is ever done, it must be limited to one dedicated mailbox, never someone's personal or staff inbox.
3. **Public calendar feeds (a good next step).** Many departments already publish a calendar link (an `.ics` or RSS address, from Google Calendar, Outlook or the school's events system). Orbit can read only the specific links you register, with no password and no mailbox access, and show those events labelled with their source. Imported events would wait for a host's approval before students see them.
4. **Forward to Orbit (also reasonable).** A host forwards an event email to one Orbit address. Orbit only ever sees what was sent to it, checks the sender is on an allow list and that the email passes the sender checks (SPF and DKIM), and puts a draft in front of the host to approve.
5. **An approval queue.** Clubs and departments suggest an event; the campus events coordinator approves it. This can sit in front of 3 and 4.

Recommended order: 1 now, 5 and 3 next. Skip 2.
