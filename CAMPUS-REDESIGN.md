# Campus redesign: the Discord model

Decisions from the questionnaire (2026-10-27). Goal: less text, less "form and card" feel, one place per club.

## Campus home
- A vertical **server rail** of the clubs you joined (round icons in each club's own colour), with **Discover** beside it: campus events and clubs to join.
- Circles are the same kind of server, lighter (general + events). Official offices carry the verified badge and are announcement-only for non-staff.

## Inside a club
- **Channel sidebar** on the left: Feed, Dashboard (officers: "Manage"), and channels. Every club starts with `announcements`, `events`, `general`, `feed`. Pods and custom channels sit below.
- **Events** live in the `events` channel as rich event cards (RSVP, check-in, co-host badge) and post there automatically. The Campus-wide list remains for discovery.
- **Members panel** on the right (toggle from the header): online first, then offline, grouped by role, with counts, role badges and titles, a mini profile card on tap (major, year, mutual clubs, Message), search, and invite/share link for officers.
- **About** goes away as a tab. The top card shrinks to name, verified badge and an (i) button. The (i) sheet holds description, meeting time, category, join code, and the president's editing and club settings (roles, applications, code).
- **Dashboard** becomes an officers-only **Manage** view opened from the header: tasks, applications, attendance, roles.
- Each club picks an **accent colour and icon** that tints its rail icon, header and highlights.

## Phones
- Swipe right for channels, swipe left for members; header shows club and channel name.

## Rollout (push after each, you review)
1. Campus home: server rail + Discover
2. Club shell: channel sidebar, members panel, (i) info sheet
3. Events and feed channels
4. Manage view, phone drawers, club colours and icons

## Status
- Phase 1 (rail + Discover), phase 2 (club shell, members panel, info sheet), phase 3 (channels in the sidebar, events channel) are live.
- Phase 4: each club's colour and icon (picked by the president in the (i) sheet) tint the rail, header and highlights. Needs `20261031100000_club_look.sql` (adds `accent` and `icon` to `campus_orgs`); the app works without it and says so when you try to save.
- Not done: a separate `announcements` channel (needs a database change to create it for every club), swipe gestures are untested on a real phone.
