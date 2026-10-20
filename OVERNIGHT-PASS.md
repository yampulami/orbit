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
