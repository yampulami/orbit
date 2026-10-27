# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The new web app in `web/` (Vite, React, React Router, Supabase) is the product of record from now on. The Expo app in `mobile/` stays as a demo and reference implementation. The older Vite prototype in `src/App.tsx` is legacy.

## Users

All students at a single university, both residents and commuters. They use Orbit to see what is happening on campus, talk with classmates, coordinate with roommates, and find events, clubs, dining, and services. One account belongs to one university, and what a student sees is scoped to that campus.

## Product Purpose

Orbit is one campus-life app for a single university. It combines a campus social feed, messaging, roommate coordination, and campus discovery. Success means a student can catch up on campus, act on something (reply, register, split an expense, plan a hangout), and get back to their day without juggling separate apps.

## Positioning

- **Campus-scoped by account.** The feed, group chats, direct messages, and events are visible only to accounts at the same normalized university. This is enforced by row-level security, not by convention.
- **Social and shared living in one place.** The feed and messages sit next to roommate spaces: chores, groceries, expense splitting, quiet hours, and hangouts. General social apps and university portals don't offer this combination.
- **Safety built in.** Follows, blocking, and safety controls are core product features (`supabase/migrations/20261019130000_safety_and_connections.sql`).

## Operating Context

- Students use Orbit in short check-ins, mostly on phones and laptops between classes.
- The main navigation areas are Feed, Roommates, Messages, Hangouts, and Campus.
- Feed post types are Post (text, one media attachment, link, location, optional poll), Event (registration, date, audience), and Marketplace (price, pickup/drop-off).
- Community tags are Everyone, Commuters, Residents, Roommates, and Marketplace.
- Campus covers events, clubs, dining, and services.

## Capabilities and Constraints

- **Live on Supabase:** email/password auth with confirmation, the campus feed (posts, likes, comments, poll votes, event registrations, realtime refresh), private media in the `feed-media` bucket with signed URLs, campus group chats, social profiles, direct messages, follows, and safety controls.
- **Local-only today:** roommate spaces, hangouts, profile preferences, composer drafts, and marketplace seller chat. The interface must label what is saved only on this device versus what is shared.
- **Not built:** verified university membership (an email suffix does not prove student identity), moderation workflows, notifications delivery, payments, real bookings, emergency reporting, GIF search, and public post URLs. Sample campus events, menus, and people are fictional.
- **Terminology:** "space" means a roommate household. "Campus" means the university-scoped discovery area.
- **Open:** how much of the mobile feature set the web app must reach, and in what order.

## Brand Commitments

- The product is named **Orbit** (renamed from "Campo"; storage keys keep compatibility).
- The incumbent visual direction is recorded in `FIGMA-DESIGN-PROMPT.md` and in the mobile theme (`mobile/src/theme.ts`). Visual decisions belong to DESIGN.md and new-work, not to this file.

## Evidence on Hand

- Design and verification history: `mobile/DESIGN-REVIEW.md`, `mobile/FEED-DESIGN.md`, `mobile/IMPROVEMENT-ROUNDS.md`, and `mobile/VERIFICATION.md`.
- Schema and policies: `supabase/migrations/`.
- No real users, testimonials, usage metrics, university partnerships, or press exist. Future work must not invent them.

## Product Principles

1. **Campus first.** Every feature serves people at the same university, and scoping is never weakened for reach.
2. **Tell the truth about state.** Distinguish between saved on this device, shared with your campus, and not yet built. Don't show fake progress, invented urgency, or unverified claims.
3. **Get in, act, get out.** Keep the overview short and put the details in focused lists and sheets.
4. **Recoverable actions.** Prefer undo, previews of consequences, and preserved drafts over confirmation walls.
5. **Safety is a feature.** Blocking, follows, and scoping controls stay visible and easy to reach.

## Accessibility & Inclusion

Earlier rounds set these practices: 44-point touch targets, labels that don't rely on color alone, visible focus states, accessible names for icon buttons, respect for reduced motion, and checked contrast for the main text pairs. The web app keeps these practices. No formal WCAG certification is claimed.

## Round of 2026-10-26: feel, messaging and planning

- **Haptics.** A small tap on buttons, switches, ticks, sending and receiving messages (`web/src/lib/haptics.ts`). Android vibrates; iPhones borrow the system switch tap; computers do nothing. It respects the device's reduced-motion setting and has a switch in Profile.
- **Messaging.** Unread count on Messages (sidebar, menu, bottom bar and the tab title), "Seen" under your last message, and a typing indicator, all live. An offline banner says so when the connection drops and catches everything up when it returns.
- **Planning.** A weekly class schedule (kept on the device for now, per person) that shows on the week board, the day's agenda and "Coming up".
- **Feel.** Skeleton loading instead of blank or wrong screens, friendly empty states, softer press and tick animations, pages that rise in, and pull to refresh on phones.
- **Around the app.** Keyboard shortcuts (`?` lists them: `g` then a letter to go to a page, `n` new post, `/` search), an install option in Profile, and larger tap areas for small buttons on touch screens.
- **Checked.** Every page at desktop and phone width for sideways overflow, unnamed controls, unlabelled fields and small tap targets; the live checks (unread badge, Seen, typing) were run with two real accounts in separate tabs.
- **Not done, and why.** Class schedules do not follow you between devices yet (that needs a database table, so it is a small follow-up). Haptics on iPhone depend on iOS 17.4 or later, and I could not test on a physical phone.

## The phone layout (2026-10-27)

On a phone (700px and narrower; tablets get the same tab bar) Orbit is a different, lighter layout rather than the desktop squeezed:

- **A bottom tab bar** (Feed, Messages, Groups, Plans, More) with labels and unread badges; "More" opens the menu with Roommates, Map and Profile.
- **A slim top bar** with the page name, a search icon (the box opens full width when tapped) and the bell. It tucks away when you scroll down and returns when you scroll up.
- **One pane at a time for chats:** Messages and Groups show a list; opening one shows the chat full screen with a back button, and the tab bar steps aside so the message box sits at the bottom.
- **Feed:** a round compose button instead of the composer card, hangouts folded into one line until tapped, a single "Happening on campus" line, and no side panels.
- **Plans:** a two-week day strip, that day's agenda (hangouts, classes, campus events, reminders), campus events and "Coming up". The month calendar and the week board are desktop-only, and are not even downloaded on a phone.
- **Sheets:** the post box and the emoji picker open as bottom sheets.
- **Lighter and more native:** no glass blur or entrance animations, flatter shadows, no tap flash, no browser pull-to-refresh (Orbit's own instead), 16px inputs so iPhones do not zoom, and long lists skip drawing what is off screen.

## The Orbit assistant (2026-10-30)

A small orb floats in the corner of every page in the app (bottom right on a computer, bottom left above the tab bar on a phone). Tap it and the assistant opens over the page: a pill you type into launches a ball of dots that thinks, then settles into a small answer card ("Ask another" starts again; Escape or the X closes it). The interface is `web/src/components/MorphOrb.tsx`; the floating button and overlay are `Assistant.tsx`.

- **What it answers.** It answers from what Orbit itself knows, in `web/src/lib/assistant.ts`: what is on tonight, tomorrow or this week, a club by name, your next class, your reminders, unread messages and notifications, how check-in, clubs, roles and pods work, and "open messages" style requests (it opens the page behind the overlay).
- **It is not an AI model.** It matches what you ask against Orbit's own data with plain rules. Nothing you type leaves the app. It will say so when it does not understand. A real language model could be plugged in later by replacing `answerFor`, which would need a server function and an API key kept off the device.

