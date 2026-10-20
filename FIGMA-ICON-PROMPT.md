# Figma AI prompt: Orbit icons and illustrations

Paste the prompt below into Figma AI. When the exports are ready, drop the SVG files into a folder in the project (for example `web/public/icons/`) and they can be wired into the sidebar, filter pills, badges and empty states.

---

```
Design a small custom icon and illustration set for "Orbit", a campus-life web app for university students (feed, group chats, hangout planning, calendar). The feel is friendly, soft and modern: rounded shapes, pastel color, a little playful but not childish. Think calm and social, not corporate and not cartoonish.

STYLE RULES (apply to everything)
- 24x24 px grid, 2px padding inside the frame, live area 20x20.
- Line icons: 1.75px stroke, round caps, round joins, no sharp corners.
- Same corner radius, stroke weight and level of detail across the whole set, so they look like one family.
- Single color using currentColor, no gradients, no shadows, no effects. Flat shapes only.
- Optional: one small filled accent shape per icon (a dot, a spark) to give Orbit its character, used the same way in every icon.
- The motif that ties everything together: a small circle "orbiting" a bigger shape. Use it subtly, not literally in every icon.

DELIVER 1: LOGO MARK
- A simple mark for "Orbit": a rounded circle with a smaller dot orbiting it. Works at 16px (browser tab) and large.
- Versions: solid dark on light, solid white on purple, and a monochrome one.
- No wordmark needed, but include one clean lockup with the word "Orbit" in a friendly geometric sans.

DELIVER 2: NAVIGATION ICONS (24px, line style, plus an active filled variant)
1. Feed: a home or campus-bulletin feel
2. Messages: a rounded speech bubble
3. Groups: two or three friends together
4. Plans: a calendar with a small check or dot
Also: Profile, New post (plus), Sign out, Light/dark switch (a sun and moon).

DELIVER 3: FILTER ICONS (20px, line style, same family)
All, Everyone, Commuters, Residents, Roommates, Marketplace. Friendly and clear at a glance (for example a car or bus for commuters, a building for residents, a sofa for roommates, a shopping bag for marketplace).

DELIVER 4: BADGES (64px, illustrated but still flat, each in a soft circle)
1. First post
2. Conversation starter
3. Group starter
4. Say yes
5. First hangout (coffee cup)
6. Regular (calendar with a check)
7. Rainy day (small cloud with rain, but a happy feeling)
Each badge sits on a pastel circle. Use these tints: pink, lavender, mint and peach (one per area), with a dark ink line or shape on top. Same style as the icons, with slightly more detail.

DELIVER 5: EMPTY-STATE ILLUSTRATIONS (about 200x160, flat, friendly, no text)
1. "No hangouts yet": a couple of friends with a coffee cup
2. "No badges yet": a small empty shelf or a sleepy orbit
3. "No posts yet": a quiet campus bulletin board
Keep them simple, using the same pastel palette on a transparent background.

COLORS
- Violet #6657C9 (primary brand), deep violet #4B3C9E
- Dark ink #1A1613, cream #FBF7F3
- Pastels: pink #F3C3C3, peach #FBD9B4, lavender #D0CAF9, mint #BDEED3, butter #F6E6A6
- Gold accent #F2C86B
- Everything must also look good on a dark background (#0E0C15). Provide each icon so it can switch color with the theme.

EXPORT
- Each icon as its own clean SVG, named in kebab-case (nav-feed.svg, nav-messages.svg, badge-first-post.svg, empty-hangouts.svg, and so on).
- Outlines kept as strokes where possible, no embedded images or fonts, simple paths, and a viewBox of 0 0 24 24 for the 24px icons.
- Use currentColor for strokes in the line icons.
```

---

## After Figma

- Export every icon as SVG using the names above.
- Put them in one folder in the project and tell Claude where.
- If the style comes out very different from the rest of the app, share a screenshot first and adjust the prompt before wiring them in.
