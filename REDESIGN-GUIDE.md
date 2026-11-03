# Orbit redesign guide

Everything that was decided and changed on the **Feed** (home) page, the **left bar**, the **search** and the **assistant**, written down so the same look can be carried to the other tabs (Chats, Roommates, Plans, Free time, Campus, Map, Profile, Groups, Clubs, People) without guessing.

This guide describes the app as of the last push on `main`. The older `DESIGN.md` in the repo root still describes the previous cream-and-violet palette and is out of date; this file replaces it as the working reference until `DESIGN.md` is regenerated.

---

## 1. Concept

**What Orbit is for:** a student opens it between classes to answer one question: *what is my next hour, and what needs me?* Posts from the campus come second. The app should feel like it **does something for the student**, not like a social feed with a calendar bolted on.

**Mode:** *Operate*. Scanability, consistency and keyboard speed outrank decoration. Brand lives in small, precise details (one orange accent, a calm type scale, an orb that blinks).

**Principles that came out of the work**

1. **One accent.** Persimmon orange is the only colour that means "act here" or "this is Orbit". Everything else is ink, grey or surface.
2. **Say what the screen is.** A first-time student should know what a block is for without reading anything else. Headlines are plain sentences ("Open mic night at 5:00 PM", "3 plans from friends need your answer").
3. **Fewer blocks above the content.** Each page gets one header sentence, one input, one list. Anything else folds or moves to the right column.
4. **No duplicates.** If the headline already asks about a plan, the list below does not repeat it. If a filter exists, the composer's audience is a quiet "Audience: Open to all, Change" line.
5. **Quiet chrome, loud content.** Containers are flat and hairline-bordered; the student's words and the next event carry the weight.
6. **Everything has a keyboard path** and a visible focus ring.
7. **Honest labels.** "Everyone" is shown as "Open to all", "Marketplace" as "For sale", "Sync" as "Free time". Buttons name their action ("Post to Commuters").

**What the owner asked for, in their words (keep these true on every page)**

- "Don't change the structure of what we already built, just make it look less AI-made."
- The app should feel like it does something for the student. The right column stays and is for quick reminders.
- Orange accents are for branding on components, never a halo on the logo.
- The left bar behaves like the **Supabase dashboard sidebar**.
- Search is an **expanding search dock** (21st.dev, "Expanding Search Dock").
- The assistant is a **floating orange sphere** that opens the chat when clicked.
- No decorative icon circles in lists.

---

## 2. Colour

All colour is a CSS variable on `:root` in `web/src/styles.css`. Never write a hex in a component; use the token. (`--accent` keeps its old name so 200+ existing uses did not need touching; it now means persimmon.)

### Light theme

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f1f2ee` | page ground |
| `--panel` | `#e6e9e2` | hover / selected row / quiet fills |
| `--surface` | `#ffffff` | cards, bars, popovers |
| `--raised` | `#dde1d8` | pressed / raised fills |
| `--ink` | `#151a18` | text, focus ring, active tab underline |
| `--ink-soft` | `#4f5a55` | secondary text (6.4:1 on `--bg`) |
| `--line` | `#d3d8cf` | hairlines and borders |
| `--on-ink` | `#f1f2ee` | text on an ink fill |
| `--accent` | `#b5472a` | brand orange (rust in light) |
| `--accent-deep` | `#8c3219` | hover on accent |

### Dark theme (`[data-theme=dark]`)

| Token | Value |
|---|---|
| `--bg` | `#101311` |
| `--panel` | `#171b19` |
| `--surface` | `#1d2220` |
| `--raised` | `#272d2a` |
| `--ink` | `#eef1ee` |
| `--ink-soft` | `#a5aeaa` (7.1:1 on `--surface`) |
| `--line` | `#2d3431` |
| `--on-ink` | `#101311` |
| `--accent` | `#ff7a45` (bright persimmon) |
| `--accent-deep` | `#b5472a` |

### Tint pairs (soft fills for tags and category chips)

`--pink / --pink-ink`, `--peach / --peach-ink`, `--lav / --lav-ink`, `--mint / --mint-ink`, `--butter / --butter-ink`. Each has a light and a dark value. Use sparingly; they are for category, not decoration.

### Rules for orange

- **Do:** the active nav icon, the New post icon, the Plans dot, "I'm in" links, the filled primary button, the filter underline you are on, the small dot before a section title, text selection, the caret, the assistant sphere, the day-bar plan marks.
- **Don't:** the logo (no halo or ring), audience tags, passive labels, big filled blocks, gradients on text.
- **Contrast:** on a filled orange button in **dark** mode the text is `#1a1210` (white on `#ff7a45` is only 2.6:1). In light mode white on `#b5472a` is 5.4:1.

---

## 3. Type

**Fonts** (both self-hosted through `@fontsource-variable`, imported in `web/src/main.tsx`)

| Role | Font | Where |
|---|---|---|
| Display / headings | **Bricolage Grotesque Variable** (`--display`) | h1 to h3, headline sentence, section titles |
| Body / UI | **Hanken Grotesk Variable** (`--font`) | everything else |

Numerals are tabular (`font-feature-settings:"tnum" 1`). Headings use `letter-spacing:-.025em`, `text-wrap:balance`.

**Scale: six sizes plus one reading size** (tokens on `:root`; never invent another)

| Token | Size | Use |
|---|---|---|
| `--t-micro` | 12px | keys, counts, captions, kbd |
| `--t-meta` | 14px | secondary lines, small controls, tags |
| `--t-ui` | 16px | body and main controls, row titles |
| `--t-row` | 18px | day names, post titles |
| `--t-h2` | 20px | section headings in the main column |
| `--t-hero` | 30px (fluid down to 24) | the one headline per page |
| `--t-read` | 17px | post text, the one reading size (line-height 1.55, max 72ch) |

**Hierarchy rule:** one 30px headline, then 20px section titles, then 16px module titles. Module blocks that are secondary (Plans waiting, On campus soon) use the 16px style so the posts' heading outranks them.

**Weights:** 400 body, 500 labels, 600 for names, buttons and headings; nothing heavier.

---

## 4. Shape, space, depth, motion

- **Corners:** containers **12px**, controls **8px**, tags **6px**, the search dock 22px, avatars and the sphere fully round. **No pills:** `border-radius:999px` is not used for buttons, tabs, chips or selected rows (the owner said pills look wrong, especially in light mode). No 24 to 32px blobs. The global `.btn` is already 8px; about 89 older rules in `styles.css` still say 999px and get replaced as each tab is redone.
- **Borders over shadows.** Cards are `box-shadow:0 0 0 1px var(--line)` or `border:1px solid var(--line)`. Real shadows only on things that float (the open sidebar, the search card, popovers): offset and soft blur, never a coloured halo.
- **Spacing:** rows are 44px minimum for anything clickable. Section gaps 24 to 32px; inside a card 12 to 14px.
- **Motion:** one authored moment per surface. Springs on the search dock (stiffness 300, damping 30) and the sphere; 120 to 150ms on the sidebar width; all motion respects `prefers-reduced-motion`. No scattered fades.
- **Dividers:** hairlines (`--line`), not boxes inside boxes.

---

## 5. Components and how they look now

### 5.1 Left bar (the Supabase-style sidebar)

Files: `components/Shell.tsx`, the "left bar" blocks at the end of `styles.css`.

- A flat panel in the page's own colours (`--surface`, 1px `--line`, 12px radius). Not orange, not a pill, no white active tile.
- **Rail 64px wide, items 36px tall, icons 20px, labels 13px / weight 500.** Active item: `--panel` background, ink text, **orange icon**.
- **Three modes**, chosen from the "Sidebar" button at the bottom and remembered in `localStorage["orbit-side-mode"]`:
  - **Expand on hover** (default): the rail opens to 220px **over** the page when you point at it (or keyboard-focus it), and closes when you leave. The page behind never moves.
  - **Expanded**: pinned open, the page makes room.
  - **Collapsed**: pinned shut; each icon shows a small name tag beside it after a short pause.
- Order: logo, seven pages (Feed, Chats, Roommates, Plans, **Free time**, Campus, Map), New post (orange icon, no fill), spacer, then a quiet group (Shortcuts, Light/Dark mode, Sign out, Sidebar), then Profile.
- Tooltips carry the keyboard hint, for example "Chats · G then M".
- The logo is the **original Orbit face** (`components/Orb.tsx`), sized to 32px so it fits the rail.
- On phones the same items become a bottom tab bar (unchanged).

### 5.2 Search (expanding dock)

File: `components/GlobalSearch.tsx`. Opens with the round button, `Ctrl/Cmd+K` or `/`.

- Closed: a 44px round button (`--surface`, hairline).
- Open: grows in place (spring) into a 22px-radius pill with the field and an X. A card opens under it with a row of scopes (**Everything, Posts, People, Clubs and events, Groups and plans**) and the results.
- Results: icon, title, one sub-line, a small kind label, a chevron on the active row. Typing a page name offers that page ("free time", "dm", "calendar" all work).
- Enter opens the highlighted row, arrows move, Escape or X closes and returns focus to the button. Clicking outside closes.

### 5.3 Assistant (floating sphere)

Files: `components/Assistant.tsx`, `components/OrbAvatar.tsx`.

- A 68px orange sphere with grain, a glossy highlight and **two blinking eyes**, floating bottom-right, bobbing 6px every 4.5s. Press it and it squashes. Clicking opens the AI chat. Draggable as before.
- Built from the pasted "AI Avatar" component, rebuilt without Tailwind and recoloured from blue to orange (`#a63e10 → #e27a2a → #ffb46a → #ffe8cc`).
- Class names are prefixed `av-` on purpose: the old Orb already owns `.orb-eye` and `orb-blink`, and reusing them stacked both eyes into one.
- Hidden on phones on the Feed (it would cover the post button).

### 5.4 Buttons and links

- **Primary (filled orange):** one per screen at most. Dark text in dark mode.
- **Secondary:** 1px ink-soft outline, transparent, 8px radius, 44px min height ("Find a time").
- **Quiet:** underlined ink-soft text link ("Ask Orbit", "Can't").
- **Answer links:** orange underlined text ("I'm in") in the headline, the plans list and the right column. Same look everywhere; the verb is **I'm in** for plans and events alike, **You're in** when set.
- Disabled buttons stay visible (ink-soft text, hairline border), never fade to nothing.

### 5.5 Lists and rows

- Ruled rows (`border-top:1px solid var(--line)`), no card per row, **no round icon circles**. The title and its day say what it is.
- Small icon buttons (pin 32px, mark done 32px) have a larger invisible hit area; targets elsewhere are 44px.

### 5.6 Tags and chips

- Audience tag on a post: 1px hairline, 6px radius, 14px / 600 ink text ("For commuters", "For sale"). Neutral for every audience, including For sale.
- Scope chips in search: pill outlines, selected = ink fill.

---

## 6. The Feed page, top to bottom (the template for other tabs)

Column layout: main column fills the width, **right column 320 to 440px (24vw) pinned to the right edge**, sticky under the 66px top bar and scrolling on its own if tall. Reading lines are capped at 72 characters.

1. **Top bar (66px, opaque, sticky):** page title, round search button, bell, avatar. The filter row pins at 66px so nothing shows through a gap.
2. **Now header (`NowHeader.tsx`):** one 30px sentence. It leads with the first plan that needs the student's answer, with "I'm in / Can't" inline and "N more below". With nothing waiting it says what is next ("MODERN ART until 11:15 AM / Free 11:15 AM to 10:00 PM"). With an empty day it drops the day bar. Beside it: a secondary "Find a time" and a quiet "Ask Orbit".
3. **Day bar:** 7 AM to 11 PM; classes solid ink, confirmed plans solid orange, **unanswered plans hollow orange**, a needle for now. Key sits under it; the screen-reader label lists every item.
4. **Composer:** one field. Focusing it opens a row: "Audience: Open to all, Change (popover with a tick)", emoji, "Ctrl+Enter to post", and a button that **names the audience** ("Post to Commuters", "Post for sale"). Drafts persist per user (`localStorage["orbit-feed-draft:<id>"]`).
5. **Plans from friends:** a single line ("3 plans from friends need your answer", chevron) that opens the list. One plan shows itself. The plan already in the headline is not repeated.
6. **Free-together row (Moments):** "Cam is free with you, Mon 3:30 to 5:00 PM, N more times".
7. **Section title:** orange dot, campus name in 20px, "What students are saying" (or "Newest 50 posts").
8. **Filter row:** text tabs, "Showing / Everything 24 / Open to all / Commuters / Residents / Roommates | For sale", counts, active = 2px orange underline; "For sale" sits after a divider.
9. **Post list:** ruled rows. Avatar, name, time, audience tag; 17px body; actions **Reply · Like · Share (· Delete)** with line icons; reply thread opens inline. Keys: `j/k` move, `l` like, `r` replies (a hint appears on the focused post).
10. **Right column:** one card holding "On your list" (no icons) and "On campus soon" (compact rows with an "I'm in" link), then the Calendar fold.

---

## 7. Copy and voice

- Plain, warm, short. Student words: "I'm in", "Can't", "Open to all", "For sale", "Free time".
- Buttons are verbs; no "Submit". Counts in small grey, never bold.
- Empty states say what to do ("Nothing for commuters yet. Ask where to park, or when the shuttle runs.") and offer one or two actions.
- Errors name the problem and the way out ("That did not go through. Check your connection and try again.").
- Hints are written out in the page, not hidden in tooltips (the Ctrl+Enter hint, the "Newest 50" note).
- Renames: Everyone to **Open to all**, Marketplace to **For sale**, Sync to **Free time** (sidebar, search, shortcuts), "Hangouts waiting" to **plans from friends**.

---

## 8. Keyboard and accessibility (already done on the Feed; keep on every page)

- Shortcuts: `g` then `f/m/g/r/p/s/c/o/u` (Feed, Chats, Groups, Roommates, Plans, Free time, Campus, Map, Profile), `n` new post, `/` or `Ctrl+K` search, `?` list (grouped: pages, feed, anywhere), `Esc` closes lists or leaves a box.
- Skip links: "Skip to content", "Skip to posts", "Skip to your list".
- Every control has a name that starts with its visible text. Focus ring: 2px `--ink`, 3px offset, on everything including calendar days.
- Contrast: all text 4.5:1 or better; the only exception is the deliberately faded out-of-month calendar days.
- Touch/click targets 44px. Known smaller ones: pin, mark done, month arrows (32px).
- Posts are articles with an `aria-description` of the keys. Headings in order; one visually hidden `h1`.

---

## 9. Everything that changed (by area)

**Palette and type:** chalk ground, one persimmon accent, flat surfaces, hairlines; Bricolage Grotesque + Hanken Grotesk; six-size scale; 12px / 8px corners.

**Feed**
- New top block: sentence headline, day bar with hollow unanswered plans, answers inline.
- Plans from friends folded into one line; "On campus soon" moved into the right column; Moments reduced to one row.
- Composer reduced to a single field; audience as a popover; button names the audience; kept drafts; Escape leaves it.
- Filter row as text tabs with counts and a divider before "For sale"; audience tags neutral.
- Post actions with icons and a key hint; replies open inline; end note "Newest 50 posts".
- Layout widened: main column grows, right column on the right edge.

**Left bar:** rebuilt as the Supabase-style rail with three modes, tooltips with key hints, quiet utilities group, original Orbit face at 32px.

**Search:** Spotlight overlay was tried and replaced by the expanding search dock with scopes and page jumps.

**Assistant:** floating orange sphere (new face) that opens the chat; the "Ask Orbit" link does the same.

**Other:** "On your list" icons removed; shortcuts dialog grouped; keyboard keys on posts; sidebar and dialogs fit 800px-tall screens; phone compose opens the compose window.

**Files to look at first**
`web/src/styles.css` (tokens at the top; later blocks are overrides, see gotchas), `components/Shell.tsx`, `components/GlobalSearch.tsx`, `components/NowHeader.tsx`, `components/PlansWaiting.tsx`, `components/CampusSoon.tsx`, `components/UpcomingList.tsx`, `components/Assistant.tsx`, `components/OrbAvatar.tsx`, `pages/Feed.tsx`, `lib/shortcuts.ts`.

---

## 10. Applying this to the remaining tabs

Do each tab in this order. Keep the structure; change only the look and the clutter.

1. **Header:** replace the page's big title block with one sentence that answers "what is here for me right now?" (30px display). Put one secondary action beside it, one quiet link.
2. **Cut above-the-fold blocks to three:** header, primary input, main list. Move reminders and secondary lists to the right column card. Fold anything optional into a one-line disclosure.
3. **Replace every "card per item" with ruled rows.** Remove round icon circles, gradient avatars (use the flat initial circle), glow shadows and pastel fills that do not mean a category.
4. **Colour:** tokens only. Orange for the one primary action and answerable links; everything else ink and grey. Check dark mode.
5. **Type:** only the seven sizes above. Titles `--t-h2` or `--t-ui`; meta `--t-meta`; counts `--t-micro`.
6. **Controls:** 44px rows, 8px corners, outline secondary, orange underlined answer links. Disabled stays visible.
7. **Copy:** apply the voice rules. Rename jargon. Make empty states offer an action.
8. **Keyboard and focus:** visible ring, names that start with visible text, hints written out, Escape behaviour.
9. **Check at 1400 and 1180 wide, dark and light, and at 800px tall.** Then phone.

**Per-tab notes**

| Tab | Header sentence idea | Main list | Move to right column |
|---|---|---|---|
| Chats | "Maya replied 5 min ago" or "No new messages" | threads as ruled rows, unread count in orange | people free now |
| Roommates | "2 chores due today" | chores, groceries, expenses as one ruled list with sections | house balance |
| Plans | "Open mic night tomorrow at 5:00 PM" | agenda by day | calendar |
| Free time | "You and Maya are free Mon 3:30 to 5:00 PM" | suggested times | who is sharing |
| Campus | "3 events this week" | events and clubs as rows with "I'm in" links | your clubs |
| Map | "Where to study right now" | places as rows | filters |
| Profile | name plus one line | settings as ruled sections | none |
| Groups / Club / Person | sentence from the first fact | list | meta |

---

## 11. Gotchas learned the hard way

- **`styles.css` is layered.** Later blocks override earlier ones; the old rules were not all removed. When a change "does nothing", look for a later rule with higher specificity. New overrides go at the end; `.shell.shell` (doubled class) is used to win against old `.shell:not(.wide)` rules.
- **Class-name clashes:** `.orb-eye` and `orb-blink` belong to the old Orbit face. New components must use their own prefix (`av-`, `gs-`).
- **Dark mode text on orange** must be dark (`#1a1210`).
- **Sticky bars:** the top bar is 66px; anything pinned below it uses `top:66px` or text shows through a gap.
- **Wide screens:** do not cap the main column; cap reading lines instead.
- **Demo build:** `launch.json` name `orbit-web` (port 5174) runs a local demo with an in-memory router, so URL paths do not work; click "Open app" from the landing page. A finished profile must exist in `localStorage` or onboarding appears.
- **Old saved settings:** a stale `orbit-side-wide` value once forced the sidebar permanently open. Do not migrate old UI preferences into new modes.
- **Verify in the browser at the sizes it ships at** (1400, 1180, 800 tall) in both themes; the screenshot tool may show only the left part of wide viewports, so also measure with `javascript_tool`.

---

## 12. Quality scoreboard (impeccable critique, Feed page)

Runs scored 24 to 29 out of 40 across the work (26, 26, 24, 27, 26, 27, 26, 27, 28, 29, 27, 27, 29). The score moves a point or two between runs because an agent judges each time. The measurable parts are clean: the design detector reports 0 findings, no text fails contrast except the faded calendar days, every control has a visible focus ring, and no horizontal overflow at 375 / 1180 / 1400.

Recurring items still worth improving: too many time-related blocks at once, the same "I'm in" appearing in three places, orange being fairly loud above the fold, and phone layouts not re-reviewed after the latest changes.


---

## 13. Tab progress

| Tab | State |
|---|---|
| Feed | done |
| Left bar, search, assistant | done |
| Chats: Messages | done (sentence headline, text tabs, ruled threads, flat conversation) |
| Chats: Groups | done (same frame; flat plan card with "I'm in / Can't"; no pills) |
| Roommates | done (sentence "N chores open", text tabs, flat lists, notes as hairline cards) |
| Plans | done (sentence about the day, flat cards, plain calendar numbers, answers as links); the week grid still has dashed blocks for unanswered plans |
| Free time | done ("Find an hour you are both free", text choices for kind, length and horizon, flat result) |
| Campus: Events | done ("N events this week", text tabs and filters, flat event rows, quiet tags); the club rail on the left and the Clubs tab still need a pass |
| Map | done (flat side panel, text categories) |
| Profile and People | done (text tabs through the shared menu, flat header); the settings and edit-profile forms inside still need a pass |
| Shared round-icon menu (`GradientMenu`) | now a row of plain text choices everywhere it is used (profile tabs, club actions, event answers) |
| Club page | done (plain channel rows, flat posts, quiet tags) |
| Sign in | done by CSS only (12px card, 8px fields, orange primary); not looked at in the browser |
| Landing, Onboarding | not restyled beyond the shared button and corner rules; Onboarding has many custom screens and should be done one screen at a time |

## Cross-tab sweep (typeset, polish, harden, clarify, animate)

- Every text size on Feed, Chats, Roommates, Plans, Free time, Campus and Profile now sits on the seven steps (12, 14, 16, 17, 18, 20, 30 px). Checked by measuring computed sizes in the demo; only avatar letters differ on purpose.
- Pills are gone from tags and counts (6px). Small inline links keep their look but get a 44px hit area.
- Long names wrap or clamp instead of breaking rows.
- Copy: "Group hangouts · private plans with your groups" became "Plans · from your groups"; plan card tags show just the group name.
- Motion: one short rise-in when a tab's content changes (`orbit-in`, 220 ms) and a small pop on a ticked box (`orbit-tick`); both off under reduced motion.

## Club icon library

`web/scripts/pull-club-icons.mjs` fetches 183 Phosphor icons (MIT) from Iconify and writes `web/src/lib/clubIcons.generated.ts`. Nothing is requested from Iconify while the app runs. A club stores `i:XX` (two-character id, fits the 8-character database column). Only append to the script's lists, never reorder, so saved ids keep their meaning. `ClubGlyph` draws any icon, emoji or first letter; the picker is in the club About window.
