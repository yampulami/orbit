# Orbit web

The Orbit campus-life web app: a social feed, friend groups with chat, hangout planning with Yes/No answers, a calendar, and optional streaks and badges. Built with Vite, React 19, React Router, Framer Motion and Supabase.

The design system is documented in [`../DESIGN.md`](../DESIGN.md) and the product context in [`../PRODUCT.md`](../PRODUCT.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Copy `.env.example` to `.env.local` and add your Supabase project URL and publishable key. With no keys, or with `VITE_DEMO=1`, the app runs entirely in the browser with sample data and no sign-in.

```bash
npm run typecheck    # TypeScript only
npm test             # unit tests (streak, badges, undo, roommate balances and auto-assign, coming-up list)
npm run build        # production build into dist/
npm run preview      # serve the production build on :4173
npm run icons        # re-render the PNG app icons from public/icon.svg
```

## What is real and what is local

| Area | Where it lives |
| --- | --- |
| Sign in, campus feed, likes, comments, delete | Supabase (campus-scoped by row-level security) |
| Groups, group chat, hangouts and Yes/No answers | **This browser only** (`src/lib/hangouts.ts`, saved in localStorage) |
| Roommates: chores, groceries, expenses, notes | **This browser only** (`src/lib/roommates.ts`) |
| Post drafts | **This browser only** (`src/lib/drafts.ts`) |
| Calendar reminders | **This browser only** (`src/lib/reminders.ts`) |
| Streaks and badges (opt-in) | **This browser only** (`src/lib/progress.ts`) |
| Messages (direct) | Sample data in demo; a placeholder when Supabase is configured |
| Theme (light, dark, system) | This browser (`orbit-theme`) |

Groups and hangouts do not reach other people's accounts yet. Members are names typed into the group. Moving them to Supabase tables with row-level security is the next backend step.

## Project map

```
src/
  App.tsx              routes; every page except the feed is lazy-loaded
  components/          Shell (icon rail), Calendar, HangoutCard, CommunityPicker,
                       GlobalSearch, UpcomingList, Picker, icons (animated nav icons),
                       toasts, theme controls
  pages/               Landing, AuthPage, Feed, Groups, Roommates (+ roommates/ sections), Plans, Profile, Messages
  lib/                 supabase, auth, feedData, hangouts, roommates, reminders, upcoming,
                       progress, undo, theme, motion
  styles.css           one stylesheet: tokens at the top, theme overrides near the end
public/                manifest, icons, service worker (sw.js)
```

## Adding a campus to the map

Each university is one file in `src/data/campuses/`. A student sees the map for the campus they joined; if there is no file for it, the app falls back to a live lookup that can fail when the public map servers are busy, so add the file ahead of time.

```bash
npm run campus:add -- "Montclair State University"
```

This finds the campus on OpenStreetMap, pulls its named buildings and writes `src/data/campuses/<key>.json` with `"reviewed": false`. Open the file, fix the categories, delete anything that is not a student place (parking decks, private houses), then set `"reviewed": true`. Pass `--bbox south,west,north,east` if it picks the wrong area, or `--print` to look without writing. The key is the same normalized university name the feed uses. Map data is (c) OpenStreetMap contributors (ODbL).

## Deploying

`vercel.json` rewrites every path to `index.html` (single-page app), adds basic security headers, and caches built files for a year. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the host's environment variables.

The app is installable (web app manifest, PNG icons) and opens offline through a small service worker (`public/sw.js`). The service worker only handles this site's own files and is only registered in production builds. Supabase requests always go to the network.

## Notifications

Orbit is a website, so what it can do depends on whether it is open.

| Where | What works today |
| --- | --- |
| Orbit open and in view | The bell in the top bar lists what needs you (hangouts waiting for an answer, reminders that are due, places waiting for a vote). A reminder also pops up when its time comes, with Done and Snooze. Each kind can be turned off in Profile. |
| Orbit open in another tab | The same reminders can alert you from your device, if you allow it (Profile, or the nudges step of onboarding). This uses the browser's own Notification permission and needs no server. |
| Orbit closed | **Web push**, once the sender is set up. The app, the service worker, the database tables and the sending function are all in the repo; turning it on needs a key pair, two secrets and a schedule. See `../PUSH-SETUP.md`. |

Without that setup the bell and the in-app and device alerts above are what students get. On iPhone and iPad, push only works after Orbit is added to the Home Screen (iOS 16.4 or later).

## Accessibility notes

- Keyboard: every control is reachable; the calendar is one tab stop with arrow keys; the community picker supports arrows, Enter and Escape.
- Skip link, a title per page, and focus moves to the page content on navigation.
- Status is never color alone (hangout days add a dashed outline or a struck-through number).
- Reduced motion turns off animations; the light/dark switch still fades so it never flashes.
- Contrast was checked with axe-core in both themes.
