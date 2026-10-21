# Figma AI prompt: Orbit onboarding visuals and motion

Paste the prompt below into Figma AI. The questions and answer options are still being written, so the screen list is a working draft: the visuals are designed per screen *type* (pick one, pick many, type, confirm), so copy can change without redoing the art. When the exports are ready, drop the SVG files into `web/public/onboarding/` (and Lottie JSON, if you make any, next to them). The web app will animate the layered SVGs in code, so layer names matter.

Context for the design: Orbit is a campus-life web app for one university at a time. Cream ground, one violet anchor, pastel colors that mean something (pink, peach, mint, lavender, butter). Headings are set in a serif (Fraunces), everything else in DM Sans. Surfaces are flat with thin borders and 18px corners: no glow blobs, no gradients, no frosted glass. The product should not look "AI generated", so avoid the generic look: no purple-to-pink gradients, no 3D blobs, no stock cartoon students, no sparkle emoji.

---

```
Design the onboarding experience for "Orbit", a campus-life web app for university students. A new student answers a handful of questions that set up their campus, their feed and their notifications. It should feel like the first minute of a good app: calm, warm, a little playful, quick, and never like a form. Think hand-made and editorial rather than template. Desktop first (a centered 560px column inside a full-width page), and a phone layout (375px wide).

BRAND MOTIF (use it everywhere, consistently)
The idea behind Orbit is a small dot orbiting a bigger circle. Build the visuals from this system:
- A large flat circle (the "campus") with a smaller dot that travels on a thin ring around it.
- Rings that grow or fill to show progress, like years on campus, or steps completed.
- Small circles ("people") that drift into orbit around the campus circle.
Keep it geometric and minimal: circles, rings, dots, rounded rectangles, a few simple building and object silhouettes. One stroke weight (2px), round caps, flat fills, no gradients, no shadows, no glows, no texture.

SCREENS (a working draft; the questions are being finalized, so design each for its TYPE)
0. Welcome: the logo (a white circle with a violet dot on a violet field) with the dot completing one orbit, then settling. A single line and a button. Type: intro.
1. Your campus: search for a university. Visual: a simple flat campus skyline (a clock tower, a few buildings, a tree, a bench) that assembles piece by piece when a university is picked, with a pin dropping on it. Type: search and pick one.
2. What should we call you: a name field. Visual: a round avatar showing the first letter, in a pastel color, that fills in live as you type. Type: text input.
3. How long have you been here: first year through "graduate student or longer". Visual: concentric orbit rings, one added per year; picking an answer lights up that many rings around the campus dot. Type: pick one (5 or 6 options).
4. Where do you live: on campus residence, commuting, off campus with roommates, other. Visual: a building, a car or bus, and a sofa, each in a pastel circle (peach, mint, lavender, pink). Picking one pulls it into orbit. Type: pick one (large, card-like options).
5. What are you here for: events, meeting people, finding roommates, buying and selling, study groups, campus help, and more. Visual: floating colored circles ("planets") that bob gently and snap into orbit when picked. Type: pick many (chips).
6. Your pace: whether to turn on streaks and badges, framed as low-pressure and optional. Visual: a badge (a coffee cup on a pastel circle) that flips over to reveal a streak flame, with an on/off switch. Type: two choices with a preview.
7. Stay in the loop: how Orbit may nudge you (hangout answers, reminders, map votes). Visual: a small bell with a dot that swings once. Type: toggles.
8. Look: light, dark or follow the device. Visual: a small app mockup that cross-fades between cream and dark as options are hovered. Type: pick one.
9. You are in: the finale. The rings complete, the dots settle into a tidy orbit, the campus name appears. Flat confetti made only of small circles and rounded rectangles in the five pastels. One button into the app. Type: celebration.

PROGRESS INDICATOR
A row of small dots at the top that is one orbit in miniature: the current step is a larger ring with a dot on it; completed steps are filled; upcoming ones are hollow. Design the three states, plus a back arrow, and a skip link.

MOTION SPEC (design the keyframes as frames or as a prototype, and note timings)
- Feel: quick and snappy, like a spring that settles, never slow or floaty. Most motion 180 to 280 ms, the finale up to 1.4 s.
- Easing: a strong ease-out, cubic-bezier(0.16, 1, 0.3, 1), or a spring with stiffness about 520 and damping about 42.
- Between steps: the old content moves 24px left and fades out while the new content moves in from 24px right (reversed when going back). The illustration swaps by morphing or sliding, not by a hard cut.
- Choices: when an option is picked it gives a small press (scale 0.97), then settles with a filled state. Selected options in the multi-pick screen move into orbit around the campus circle.
- One authored moment per screen, not scattered effects. No looping motion except very gentle idle bobbing on the "planets" (3px, 4 s), and that stops when the user prefers reduced motion.
- Reduced motion: provide a version where every transition is a plain 120 ms fade and no object moves.
- Give every animated object its own named layer so it can be animated in code: for example campus-circle, orbit-ring-1, orbit-dot, planet-events, planet-people, badge-front, badge-back, bell, bell-dot, confetti-circle-01.

CUSTOM VISUALS TO DRAW (flat, one consistent style)
- The logo mark and the orbit system: campus circle, rings (1 to 6), orbiting dot, small people-dots in each pastel.
- The campus skyline for screen 1: clock tower, three building shapes, tree, bench, a ground line. Generic, not a real campus. Provide it as separate pieces so it can assemble.
- Screen 4 objects: building, car or bus, sofa, each on its own pastel circle.
- Screen 5 planets: 8 circles in the five pastels with a tiny glyph each (calendar, two people, key, shopping bag, books, lifebuoy, coffee cup, speech bubble).
- Screen 6 badge: coffee cup on a circle, plus its back side with a flame.
- Screen 7 bell with a dot.
- Screen 8 mini app mockup in light and dark.
- A small set of 12 confetti pieces for the finale.

COPY TONE (for the mockups; real copy will change)
Warm and direct, short sentences, no exclamation overload, no jargon. Examples: "Which campus is yours?", "Almost there.", "You are in." Headings in a serif, sentence case.

TYPE AND LAYOUT
- Headings: Fraunces (serif), 32 to 40 px on desktop, 28 px on phone, weight 500, tight tracking.
- Body and buttons: DM Sans, 16 px, buttons 48 px tall with fully rounded ends.
- A generous margin, one question per screen, the illustration above or beside the question, never behind the text.
- Cards and inputs: flat, 1px border, 18px corners. Selected state: ink-colored border and a soft pastel fill. Not glassy.

COLORS
- Violet #6657C9 (primary brand), deep violet #4B3C9E
- Dark ink #1A1613, cream #FBF7F3, panel #F1E8E1, line #E6DBD2
- Pastels: pink #F3C3C3, peach #FBD9B4, lavender #D0CAF9, mint #BDEED3, butter #F6E6A6
- Matching dark inks for text on pastels: pink #7A2F35, peach #7A4A14, lavender #3B3482, mint #1F6A47, butter #6B5A0F
- Gold accent #F2C86B
- Dark mode: background #0E0C15, panel #191624, surface #211D2E, text #F2EEFB. The pastels become deeper, muted tints in dark mode (for example pink #51283A, lavender #373168, mint #1D4636). Design every screen in both themes.

ACCESSIBILITY
- Text contrast at least 4.5:1, including on the pastels.
- Never rely on color alone: selected options also get a check mark and a thicker border.
- Touch targets at least 44 px.
- All illustrations are decorative, so they must still make sense when removed.

EXPORT
- Each illustration as its own SVG with named layers, kebab-case file names (onboarding-campus-skyline.svg, onboarding-orbit-rings.svg, onboarding-planets.svg, onboarding-badge.svg, onboarding-bell.svg, onboarding-confetti.svg, and so on). Strokes kept as strokes where possible, no embedded images or fonts, simple paths, viewBox set.
- Use currentColor for ink, and CSS variable-friendly fills where possible, so the art can switch between light and dark.
- A Figma prototype of the whole flow (desktop and phone) in both themes, and a short note listing every animation with its duration and easing.
- Optional: Lottie JSON for the finale and the welcome orbit, if the Figma plugin allows it.

AVOID
Gradients, glows, glass or blur effects, 3D, drop shadows, stock-photo or cartoon students, emoji, sparkles, anything that looks like a generic AI-generated landing page.
```
