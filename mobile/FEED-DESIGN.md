# Orbit Feed — September 28, 2026

## Navigation
Feed replaces Home and is the default screen. Bottom navigation is Feed, Roommates, Events, Hangouts, Campus. Existing shared-space data and personal hangouts remain accessible. The Orbit mark opens the profile; the bell opens notification status.

## Post types
- Post: text, one photo/video attachment, explicit hyperlink, manually entered location, emoji insertion, optional 2–4-option poll.
- Event: title, organizer, description, future date/time, location, optional media, and target audience. A registration action appears above likes/comments/share. The same post record appears in Feed and Events, with Upcoming, Registered, and Past filters.
- Marketplace: item name, description, price (including free), location, Pickup/Drop-off/Either, optional media, and a listing-specific local chat preview.

Community tags are Everyone, Commuters, Residents, Roommates, and Marketplace. Marketplace listings receive the Marketplace tag automatically. Feed supports text search and community filtering. Event search is separate from feed search.

## Behavior and persistence
Posts, likes, comments, single-choice poll votes, registrations, and preview messages are saved in the existing account-scoped local store. An optional feed field preserves compatibility with old saves. Three clearly labeled sample posts illustrate the types. Removing your own post offers session-only Undo. Share invokes the platform share sheet with post text; no public post URLs exist yet.

Composer drafts survive closing the composer and switching between Feed and Events while that screen remains mounted. They are not durable across app reloads or leaving these tabs. Published posts are durable.

## Media
Native media selection accepts photos/videos under 40 MB and copies published local files into the app document directory. Videos have playback controls and do not autoplay. Web preview accepts image attachments up to about 1.5 MB as embedded data, avoiding expired object URLs after reload. Video picking/playback and photo permissions still need physical-device testing. Deleted post attachments are retained locally so Undo can restore the post; media cleanup is future work.

## Still local
No posts are sent to other students. Event registrations are local selections, not organizer confirmations. Marketplace messages are not delivered, and the notification bell does not fabricate replies or reminders. A live release needs Supabase feed tables and access rules, storage uploads, server-backed registration and messaging, moderation/reporting, and real notification delivery. GIF search is not included.

## Verification
49 automated tests cover existing features plus post validation, safe links, currency precision, vote changes, registration counts, filtering, backwards compatibility, and account isolation. Mobile TypeScript, root Vite build, and iOS/Android/web exports pass.

Browser at 390 × 844: created a commuter poll, liked/voted/commented, reloaded and confirmed the saved interaction state; created an event and verified it in both tabs; registered a sample event in Feed and verified it in Events; created a marketplace listing with a repository test image and saved a preview message. Test posts were removed through the UI; sample registration was restored. No real accounts, messages, or event registrations were sent. Browser error logs were empty during final review.
