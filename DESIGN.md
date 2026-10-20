---
name: Orbit
description: A soft, pastel campus-life web app for students. Cream ground, one violet anchor, community-coded color.
colors:
  cream: "#fbf7f3"
  parchment: "#f1e8e1"
  paper: "#ffffff"
  clay: "#efe5dd"
  ink: "#1a1613"
  ink-soft: "#5f5650"
  hairline: "#e6dbd2"
  violet: "#6657c9"
  violet-deep: "#4b3c9e"
  gold: "#f2c86b"
  pink: "#f3c3c3"
  peach: "#fbd9b4"
  lavender: "#d0caf9"
  mint: "#bdeed3"
  butter: "#f6e6a6"
  pink-ink: "#7a2f35"
  peach-ink: "#7a4a14"
  lavender-ink: "#3b3482"
  mint-ink: "#1f6a47"
  butter-ink: "#6b5a0f"
  night: "#0e0c15"
  night-panel: "#191624"
  night-surface: "#211d2e"
  night-raised: "#2b2640"
  night-ink: "#f2eefb"
  night-ink-soft: "#b4adc9"
  night-hairline: "#332e47"
typography:
  display:
    fontFamily: "DM Sans Variable, DM Sans, system-ui, sans-serif"
    fontSize: "clamp(2.8rem, 8vw, 6rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "DM Sans Variable, DM Sans, system-ui, sans-serif"
    fontSize: "1.4rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "DM Sans Variable, DM Sans, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans Variable, DM Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans Variable, DM Sans, system-ui, sans-serif"
    fontSize: ".82rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "14px"
  md: "24px"
  lg: "28px"
  xl: "32px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
    rounded: "{rounded.pill}"
    padding: "10px 22px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 22px"
    height: "44px"
  pill-filter:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
  pill-filter-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
  post-tile:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  sidebar-rail:
    backgroundColor: "{colors.violet}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    width: "96px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "22px"
---

# Design System: Orbit

## Overview

**Creative North Star: "The Pastel Common Room"**

Orbit looks like the shared lounge of a campus building: warm, soft, a little playful, and easy to walk into between classes. The page is cream. Color comes from the community a thing belongs to, so a post, a filter and a hangout in the same community share one pastel. A single violet, used for the sidebar and a few anchors, keeps the whole thing from drifting into candy.

Density is low and rounded. Cards are big, corners are generous, headings are light, and almost nothing is outlined. The app is a website for a laptop first, with the same layout folding down to a phone without becoming a phone app: the sidebar becomes a slim top bar, never a bottom tab bar. Dark mode is the same room with the lights down: deep violet-black ground, pastels turned into deep tints, the violet sidebar unchanged.

Rewards are quiet by design. Streaks and badges are opt-in, never ranked, never nagging.

**Key Characteristics:**
- Cream ground with pastel cards colored by community.
- One violet anchor (the icon rail) and a gold highlight for "today".
- Pill buttons and pill filters; large rounded cards; no hairline-heavy UI.
- Glass is a small accent on hangout cards only, never a general surface.
- Light headings, tight tracking, one typeface family (DM Sans).
- Every state is shown with more than color (shape, text, or position).

## Colors

A cream ground, five pastels that each mean a community, and one violet.

### Primary
- **Orbit Violet** (#6657c9): the icon sidebar, the active chat thread, the switch when on, the calendar and message accents. It is the only saturated color on a normal screen.
- **Deep Violet** (#4b3c9e): the text color on the active (white) sidebar tile, and the dark end of the sidebar gradient.

### Secondary
- **Gold** (#f2c86b): today in the calendar. Nothing else.

### Tertiary: the community pastels
- **Rose Petal** (#f3c3c3): Everyone. Ink: #7a2f35.
- **Apricot** (#fbd9b4): Commuters. Ink: #7a4a14.
- **Mint Frost** (#bdeed3): Residents. Ink: #1f6a47.
- **Lavender Mist** (#d0caf9): Roommates. Ink: #3b3482.
- **Butter** (#f6e6a6): Marketplace. Ink: #6b5a0f.
Each pastel has a matching dark ink used for small text on that pastel, so secondary text is tinted from the card, never gray.

### Neutral
- **Cream** (#fbf7f3): the page.
- **Parchment** (#f1e8e1): inactive pills, quiet panels, empty states.
- **Paper** (#ffffff): cards that sit on cream (composer, calendar, lists).
- **Clay** (#efe5dd): hover and raised fills.
- **Ink** (#1a1613): text and the primary button fill.
- **Soft Ink** (#5f5650): secondary text. Passes 4.5:1 on cream and paper.
- **Hairline** (#e6dbd2): the rare border.

### Dark mode
Night (#0e0c15) ground, Night Panel (#191624), Night Surface (#211d2e), Night Raised (#2b2640), Night Ink (#f2eefb) text, Night Soft Ink (#b4adc9) secondary, Night Hairline (#332e47). Pastels become deep tints: plum #51283a, amber #4e3421, indigo #373168, forest #1d4636, olive #4a4320, with light inks (#f4b9c6, #f5c898, #cbc3ff, #9de3bf, #efdc88).

### Named Rules
**The Pastel-Means-Community Rule.** A pastel always identifies a community. It is never used as decoration on something that has no community.
**The One Violet Rule.** Violet is the single saturated anchor. If a screen needs a second strong color, the design is wrong, not the palette.
**The Honest Color Rule.** Color never carries meaning alone. Hangout days use orange (needs an answer), pink (not going) and green (all set) together with a dashed outline, a struck-through number, and a hover label.

## Typography

**Display Font:** DM Sans Variable (with DM Sans, system-ui, sans-serif), self-hosted.
**Body Font:** DM Sans Variable, same file.

**Character:** One friendly geometric family used light and large for voice, medium for structure. Hierarchy comes from size and weight, not from a second font.

### Hierarchy
- **Display** (400, clamp(2.8rem, 8vw, 6rem), 1.1, -0.04em): the landing headline only.
- **Headline** (500, 1.4rem, 1.1, -0.02em): section headings such as "Hangouts" and card titles in lists.
- **Title** (500, 1.6rem, 1.1): the title on a hangout card.
- **Body** (400, 1rem, 1.5): messages and posts; post text steps up to 1.15rem at weight 500 on a tile. Keep measure under 65 to 75 characters.
- **Label** (500, .82rem): chips, meta lines, timestamps. Numerals are tabular in counters.

### Named Rules
**The No Page Title Rule.** App pages open straight into content. Page headings exist for screen readers only (`.sr`), not as large visible titles.

## Layout

A website first. At 1100px and up the home page is the feed column plus a 320px right column holding the collapsible calendar and "Active on campus". Under 1100px the right column stacks. Under 900px the floating icon rail becomes a slim rounded top bar with the same icons. Under 560px the bar keeps only the logo, New post, the four tabs and the profile avatar; sign out and appearance live on Profile.

Spacing is relaxed: 14px between cards in a grid, 18 to 20px between sections, 24px inside large cards. Hangout cards sit three to a row, then two, then one. The post grid is two columns, then one.

The floating rail is 96px wide at 20px from the page edge, 32px radius, sticky.

## Elevation & Depth

Mostly tonal layering: cream under paper under pastel. Shadows are soft and diffuse, used to lift floating things (the rail, cards on cream, toasts), never hard-edged.

### Shadow Vocabulary
- **Card lift** (`0 1px 2px rgba(60,40,25,.06), 0 8px 24px -12px rgba(60,40,25,.18)`): paper cards on cream.
- **Rail lift** (`0 18px 40px -22px rgba(75,60,158,.7)`): the violet icon rail.
- **Popover** (`0 22px 44px -18px rgba(30,20,60,.45)`): the community picker and toasts.
- **Glass edge** (inset 1px light ring plus a small drop): the hangout toggle and chips only.

### Named Rules
**The Glass Stays Small Rule.** Frosted glass appears on hangout cards on Home and the calendar (toggle, chips, avatars). Chat cards, post tiles and every other surface stay plain.
**The Steady Card Rule.** A card never changes size because of a state change. Answering Yes or No, selecting a day, or toggling tracking must not move or resize its neighbors.

## Shapes

Round everything that can be tapped. Pills (999px) for buttons, filters, toggles, chips and the picker. Large rounded rectangles (24 to 32px) for cards and the rail. Tiles on the grid are 28px. Small controls like the text fields use 14px. Circles for avatars, icon tiles and badge art. Nothing has sharp corners; nothing uses a colored side border.

## Components

### Buttons
- **Shape:** full pill (999px), 44px minimum height.
- **Primary:** Ink fill, Cream text, 10px 22px padding. Dark mode inverts: Night Ink fill, Night text.
- **Secondary:** transparent with a 1px Ink border; hover fills Clay.
- **Hover / Focus:** 200ms ease; pressed scales to .97; focus is a 2px Ink ring offset 3px (white on the violet rail).

### Chips and filter pills
- **Style:** Parchment pill with a white circle holding a community icon tinted in that community's ink.
- **State:** selected becomes an Ink pill with Cream text. Icons come from one shared map so pills and the post picker always agree.

### Cards / Containers
- **Corner Style:** 24 to 32px.
- **Background:** Paper for utility cards, a community pastel for posts and hangouts, Parchment for quiet panels.
- **Shadow Strategy:** see Elevation; pastel tiles have no shadow.
- **Internal Padding:** 20 to 24px.

### Inputs / Fields
- **Style:** Cream fill, 1px Hairline, 14px radius (pill for the community picker).
- **Focus:** 2px Ink outline with no offset; the picker border turns violet.
- **Error / Disabled:** errors are plain red text with role=alert; disabled buttons drop to 45% opacity.

### Navigation
- **Style:** a floating violet rail, 32px radius. Each tab is a rounded 52px tile in translucent white; the active tab is a white tile with Deep Violet icon, which slides between tabs on a spring.
- **Motion:** the four line icons animate on hover and when their tab becomes active (house hops, bubble dots bounce, friends lean in, calendar check draws). Reduced motion turns it all off.
- **Mobile:** the rail becomes a top bar; there is never a bottom tab bar.

### Hangout card (signature)
A pastel gradient card with a soft highlight in the top corner. Group chip and date on top, a bold title, a glass place pill, then a fixed footer: avatars with the going count, and a full-width Yes / No toggle. The selected answer is a glossy droplet that slides across (green for Yes, rose for No). Organizers get a small Cancel pill with Undo. Inside a group chat the same card is plain.

### Calendar
A month grid inside one card; collapsible on Home, always open on Plans. One tab stop with arrow-key navigation. Hangout days take the answer color with a shape cue; today is Gold; the selected day is Ink with a ring in its answer color.

## Do's and Don'ts

### Do:
- **Do** keep the ground Cream (#fbf7f3) and let pastels carry meaning.
- **Do** make every state change visible without moving other things.
- **Do** use soft Ink (#5f5650) tinted text on pastels, from that pastel's ink.
- **Do** give every deletion an Undo instead of a confirmation dialog.
- **Do** keep rewards optional, quiet and unranked.
- **Do** let motion be exponential ease-out, short, and switched off for reduced motion.

### Don't:
- **Don't** add big page titles, kicker labels, or demo notices to app pages.
- **Don't** use frosted glass on chat cards, post tiles or general panels.
- **Don't** build a phone-style bottom tab bar. This is a website.
- **Don't** let a card resize when its toggle or content changes.
- **Don't** use a second saturated color next to violet.
- **Don't** rely on color alone for status.
- **Don't** use native select lists; use the themed picker.
