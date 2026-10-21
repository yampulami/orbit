# Overnight pass: what changed

Everything below is in `web/` unless noted. Nothing is committed. All checks were run at the end: typecheck, 16 unit tests, production build, the design detector (no findings), and an axe-core accessibility scan of every page in light and dark.

## New features
- **Undo for deleting a post.** The post leaves the feed at once, and the real delete waits 6 seconds with an Undo button. Closing the tab inside that window tries to delete it right away (best effort). If the delete fails, the post comes back.
- **Cancel a hangout** (organizer only) with Undo. A canceled hangout disappears from Home and the calendar and leaves a small note in the chat.
- **Add friends to an existing group** from the group header.
- **Attention dot on the Plans tab** (orange) when an upcoming hangout needs your answer. It matches the calendar's orange days.
- **Appearance setting** on Profile: Light, Dark, or System. The sidebar button still flips light/dark. A theme toggle is also on the landing page.
- **Sign out on Profile**, plus a Ctrl/Cmd+Enter shortcut to post and a counter that warns near the 1000-character limit.
- **Landing page preview.** The hero now shows a picture of the app (made-up sample content) next to the headline.
- **Show/hide password** and autofocus on the sign-in form.

## Roommates tab (added after the overnight pass)
A shared household with five sections: **Tasks** (effort points, auto-assign to the person with the least open work, Open/Mine/Done/All filters, search, reassign), **Groceries** (by category, Needed/Purchased/All), **Expenses** (equal split, who owes whom with the fewest payments, per-expense breakdown), **Fairness** (effort bars, no ranking) and **House notes**. Creating a household also creates its private group chat, and new chores and expenses post a short message there. Everything is saved on this device only, like groups. Deleting anything offers Undo. A "Try a sample household" button fills it with example data.

## Search, profile and coming up (added after the overnight pass)
- **Top right:** a search box and your profile picture now sit in the top right of every page, like the reference. Search covers posts, hangouts, chores, groceries, expenses, house notes, reminders and groups; Ctrl or Cmd + K jumps to it, and a result opens the right page and section. On phones the profile picture stays in the top bar and the search box sits under it.
- **Reminders on the calendar:** pick a day, add a reminder with an optional time, tick it off or delete it (with Undo). Days with reminders get a small dot.
- **Coming up:** a list under the calendar on Home and on Plans. It merges your hangouts (with "Needs your answer", "Today", "Soon", "Tomorrow"), your chores in the house, and your reminders, soonest first, with overdue things on top. Chores can now have an optional due date.
- **Reminders alert you.** Pick a quick time (Morning, 9 AM, Noon, 3 PM, 6 PM) or a custom one. When the time comes while Orbit is open, a card pops up with Done and Snooze 10 min. A reminder with no time alerts at 9 in the morning.
- Reminders are saved on this device only, like groups.

## New post window (added after the overnight pass)
The round pen button in the sidebar opens a window to write a post from any page (like the one on Twitter) instead of scrolling you to the feed. It has the same "Post to" community list, a character counter, Ctrl or Cmd + Enter to send, and a **Drafts** link: closing a post you did not send saves it as a draft you can reopen or delete. After posting, a short "Posted to Everyone" note offers Undo, and the feed updates by itself.

## Bugs found and fixed
- On phones the top bar pushed sign out and your avatar off screen. The bar now keeps only what fits; sign out and appearance moved to Profile.
- On short pages (Messages, Plans, Profile) the phone top bar stretched to double height.
- Hangout cards could grow wider than their column when a title or place was long.
- The "Plan a hangout" form overflowed its card on narrow screens.
- Calendar: days outside the month and the active chat thread had weak contrast; the heading order skipped a level.
- A scroll position bug inside hangout cards (fixed earlier tonight) and a toggle that resized the card (fixed earlier tonight).

## Accessibility
- Skip link, a page title per route, and focus moves to the page content on navigation.
- Calendar is one tab stop with arrow keys, Home/End and PageUp/PageDown.
- Community picker has full keyboard support and proper listbox roles.
- Status is never color alone (hangout days add a dashed outline or a struck-through number, plus a hover label).

## Performance and deployment
- Pages other than the feed load on demand; vendor libraries are split into their own cached files. The largest file is 256 kB (was 678 kB), and the build warning is gone.
- DM Sans is now self-hosted (no Google Fonts request).
- Web app manifest with real PNG icons (`npm run icons` regenerates them) and a small service worker (`public/sw.js`) so the app opens offline and installs. It only touches this site's own files. **I could not test the service worker here** because the in-app browser blocks service workers, so test it once on a deployed or local preview in Chrome: DevTools > Application > Service Workers.
- `vercel.json` now sends security headers and long-lived cache headers for built files.

## Code quality
- 16 unit tests for the streak, badge and undo logic (`npm test`).
- Removed dead CSS. Moved the shared community icons into one file.
- Added `web/README.md`, `DESIGN.md` and `.impeccable/design.json` (the design system, extracted from the finished app).

## Not done, and worth doing next
1. **Groups and hangouts only exist in the browser they were made in.** Making them real needs new Supabase tables and row-level-security policies (hangouts, RSVPs, and friend-group membership tied to student profiles). I did not write this blind because I had no database to test the security rules against.
2. **Direct messages** are still sample data in demo mode and a placeholder with Supabase.
3. **Content Security Policy** is not set yet (it needs the inline theme script hashed and the Supabase address allowed). Do it once the host is chosen.
4. Six `npm audit` warnings remain in dev tools only (the build tool chain). The shipped app has zero.
