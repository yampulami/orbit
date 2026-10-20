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
npm test             # unit tests (streak, badges, undo)
npm run build        # production build into dist/
npm run preview      # serve the production build on :4173
npm run icons        # re-render the PNG app icons from public/icon.svg
```

## What is real and what is local

| Area | Where it lives |
| --- | --- |
| Sign in, campus feed, likes, comments, delete | Supabase (campus-scoped by row-level security) |
| Groups, group chat, hangouts and Yes/No answers | **This browser only** (`src/lib/hangouts.ts`, saved in localStorage) |
| Streaks and badges (opt-in) | **This browser only** (`src/lib/progress.ts`) |
| Messages (direct) | Sample data in demo; a placeholder when Supabase is configured |
| Theme (light, dark, system) | This browser (`orbit-theme`) |

Groups and hangouts do not reach other people's accounts yet. Members are names typed into the group. Moving them to Supabase tables with row-level security is the next backend step.

## Project map

```
src/
  App.tsx              routes; every page except the feed is lazy-loaded
  components/          Shell (icon rail), Calendar, HangoutCard, CommunityPicker,
                       icons (animated nav icons), toasts, theme controls
  pages/               Landing, AuthPage, Feed, Groups, Plans, Profile, Messages
  lib/                 supabase, auth, feedData, hangouts, progress, undo, theme, motion
  styles.css           one stylesheet: tokens at the top, theme overrides near the end
public/                manifest, icons, service worker (sw.js)
```

## Deploying

`vercel.json` rewrites every path to `index.html` (single-page app), adds basic security headers, and caches built files for a year. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the host's environment variables.

The app is installable (web app manifest, PNG icons) and opens offline through a small service worker (`public/sw.js`). The service worker only handles this site's own files and is only registered in production builds. Supabase requests always go to the network.

## Accessibility notes

- Keyboard: every control is reachable; the calendar is one tab stop with arrow keys; the community picker supports arrows, Enter and Escape.
- Skip link, a title per page, and focus moves to the page content on navigation.
- Status is never color alone (hangout days add a dashed outline or a struck-through number).
- Reduced motion turns off animations; the light/dark switch still fades so it never flashes.
- Contrast was checked with axe-core in both themes.
