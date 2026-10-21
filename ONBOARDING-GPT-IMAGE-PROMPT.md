# GPT image prompts: Orbit onboarding illustrations

For ChatGPT image generation (or any image model). The reference style you sent is: a deep purple gradient panel, a dark rounded label card tilted a few degrees, and a bold flat illustration below it (a friendly character, objects, white outlines, little four-point sparkles). These prompts rebuild that look for Orbit's campus life.

## How to use these

1. Open one new chat and send **Part 1 (the style anchor)** first. Attach your four reference screenshots if the tool allows it. Wait for it to confirm.
2. Then send the screen prompts from **Part 3** one at a time, in the same chat, so the character and style stay consistent. If a result drifts, reply "same style and character as the first image, but fix: …" instead of starting over.
3. Generate **without any text inside the image**. The label cards ("Which campus is yours?") are built in code so they stay sharp, can be translated and can animate. That is why each prompt asks for an empty space at the top.
4. Ask for each image at **1024 × 1536 (portrait)**. Ask for the purple background to be a **flat solid color** (or transparent, if the tool supports it), because the app draws the gradient itself.
5. Save each image as `onboarding-<name>.png` (names are in Part 3) into `web/public/onboarding/`. If you can get transparent backgrounds, even better: then say so and I will let the art animate on top of the app's own gradient.

## Part 1. Style anchor (send this first)

```
I am designing the onboarding screens for a campus-life app called "Orbit" for university students. I will ask you for a series of illustrations that all share one style. Remember this style for every image:

LAYOUT OF EACH IMAGE
- Portrait, 1024 x 1536.
- The top 30% is empty (a flat dark violet area) because I will place a text card there myself. Do not draw any text, letters, numbers, logos or UI in the image.
- The illustration sits in the lower 70%, large and centered, slightly cropped off the bottom edge so it feels like it is rising into the scene.

STYLE
- Bold flat vector illustration. Solid color shapes, no gradients inside the shapes, no textures, no photographic shading, no 3D rendering, no glow effects, no drop shadows.
- A friendly hand-made feel: slightly irregular rounded shapes, as if cut from paper. Thick rounded shapes for the main subjects.
- Clean WHITE line-art details on top of the flat shapes (a face outline, hands, folds, a few swooshes), drawn with a thick round-capped line, like a marker. The white line work is the signature of the style.
- A few small four-point white sparkles scattered around, in two or three sizes.
- Small accents in a pale lavender line.

COLOR PALETTE (use only these)
- Background: a flat deep violet #2A1F66.
- Main subject colors: teal-mint #6FD0C8, hot magenta #E05AD6, soft lavender #C9B8FF.
- Accents: white #FFFFFF, warm gold #F2C86B (used sparingly), dark violet #1A1240 for the darkest shapes.
- No other colors.

THE MASCOT
Several images share one friendly character: a soft, rounded blob person with no neck, a round head merged into a pear-shaped body, drawn as a flat teal-mint shape with a white line-art face (just one small eye and a tiny smile), stubby rounded arms and simple hands outlined in white. It has a small lavender dot floating near its head like a tiny moon in orbit. It is cheerful, simple, and gender-neutral. Keep it identical in every image that includes it.

AVOID
Text of any kind, realistic people, faces with detailed features, stock-photo or corporate clip-art style, glossy 3D, gradients, neon glow, busy backgrounds, brand logos.

Reply "Ready" and wait for my first scene.
```

## Part 2. Rules for every scene prompt

Each prompt below ends with the same reminder, so you can paste them alone: *portrait 1024 x 1536, flat solid violet background, empty top 30%, no text anywhere in the image, same style and palette as before.*

## Part 3. The scenes

### 1. Campus (`onboarding-campus.png`)
```
Scene: "Find your campus". The mascot stands in front of a simple flat university skyline: a clock tower with a small round clock face (no numbers), two low brick-style buildings with arched windows drawn as white line art, a leafy round tree and a bench. The mascot holds up a big round map pin in hot magenta with a small white dot in the middle, like it is planting it on the campus. A few white sparkles around the pin. Everything sits on a simple curved ground shape in lavender.
Portrait 1024 x 1536, flat solid violet background, empty top 30%, no text anywhere in the image, same style and palette as before.
```

### 2. Name (`onboarding-name.png`)
```
Scene: "What should we call you". A giant flat speech bubble in lavender with a thick white line-art outline, with a big hot-magenta round name tag stuck on the bubble (blank, no letters). The mascot peeks out from behind the bubble, waving with one hand, white line-art smile. Small sparkles and a few little lavender dots around.
Portrait 1024 x 1536, flat solid violet background, empty top 30%, no text anywhere in the image, same style and palette as before.
```

### 3. How long on campus (`onboarding-years.png`)
```
Scene: "How long have you been here". Concentric thick rings in teal-mint, lavender and magenta, like a tree trunk cross-section or orbit lines, growing outward from the center of the lower area. In the very center sits a tiny mascot sitting cross-legged, and a small gold dot travels on the outermost ring. White line-art swooshes along the rings show movement. A few sparkles.
Portrait 1024 x 1536, flat solid violet background, empty top 30%, no text anywhere in the image, same style and palette as before.
```

### 4. Where you live (`onboarding-home.png`)
```
Scene: "Where do you live". Three simple objects stacked and arranged like a playful sticker collage: a tall flat residence-hall building in magenta with white line-art windows, a small city bus in teal-mint with white line-art wheels, and a round lavender sofa. The mascot stands between them pointing to one with a thick white line-art arm. White sparkles, a curved ground line in lavender.
Portrait 1024 x 1536, flat solid violet background, empty top 30%, no text anywhere in the image, same style and palette as before.
```

### 5. What you are here for (`onboarding-interests.png`)
```
Scene: "What are you here for". Six big round bubbles floating like planets of different sizes, in teal-mint, magenta, lavender and gold, each with one simple white line-art symbol inside (a calendar, two people, a key, a shopping bag, an open book, a lifebuoy), no letters. The mascot floats in the middle, arms wide, a lavender dot orbiting its head. Sparkles between the bubbles.
Portrait 1024 x 1536, flat solid violet background, empty top 30%, no text anywhere in the image, same style and palette as before.
```

### 6. Streaks and badges (`onboarding-badges.png`)
```
Scene: "Streaks and badges". A big round badge in hot magenta with a thick white outline and a simple white line-art flame in the center, held up proudly by the mascot with both hands. Two smaller badges float beside it: a teal-mint one with a coffee cup, a lavender one with a tiny calendar check mark (symbols only, no text). Sparkles all around, a few little confetti dots.
Portrait 1024 x 1536, flat solid violet background, empty top 30%, no text anywhere in the image, same style and palette as before.
```

### 7. Nudges (`onboarding-bell.png`)
```
Scene: "How can Orbit nudge you". A large flat bell in warm gold with a thick white line-art outline, swinging slightly, with three small curved white motion lines on each side. A small magenta notification dot on the bell. The mascot leans in from the side, one hand cupped to its ear, listening. Two small teal-mint and lavender phone-sized cards float nearby, blank, with a tiny white line-art check on one and a heart on the other.
Portrait 1024 x 1536, flat solid violet background, empty top 30%, no text anywhere in the image, same style and palette as before.
```

### 8. Look (`onboarding-look.png`)
```
Scene: "Pick a look". A big circle split diagonally: one half is a bright sun in gold and cream with simple white line-art rays, the other half is a night moon in dark violet with a few white sparkle stars. The mascot stands in front of the circle holding a small switch lever with one hand, mid-flip. A few sparkles and tiny stars.
Portrait 1024 x 1536, flat solid violet background, empty top 30%, no text anywhere in the image, same style and palette as before.
```

### 9. You are in (`onboarding-done.png`)
```
Scene: "You are in". The mascot jumps with joy, arms up, in front of a big hot-magenta circle (the campus) with a ring around it and a lavender dot orbiting. Flat confetti made only of small circles and rounded bars in teal-mint, magenta, lavender and gold bursts in every direction. White sparkles in several sizes. The ground is a curved lavender shape.
Portrait 1024 x 1536, flat solid violet background, empty top 30%, no text anywhere in the image, same style and palette as before.
```

## Part 4. If a result is off

| Problem | Reply with |
| --- | --- |
| Text or letters appeared | "Remove all text and letters. Keep everything else identical." |
| Too 3D or glossy | "Make it completely flat vector, like cut paper, no gradients or shading." |
| Mascot looks different | "Use exactly the same mascot as the first image: teal-mint pear-shaped blob, one small white eye, tiny smile, lavender dot orbiting its head." |
| Too busy | "Simplify: fewer objects, larger shapes, more empty space." |
| Colors drift | "Use only these colors: #2A1F66, #6FD0C8, #E05AD6, #C9B8FF, #F2C86B, white, #1A1240." |
| Wrong layout | "Keep the top 30% completely empty and flat violet, and move the illustration into the lower 70%." |

## Part 5. What I will do with them

Once the PNGs are in `web/public/onboarding/`, I will build the left panel like your references: a violet gradient background, a dark rounded label card tilted a few degrees at the top that swaps its text (and icon) with a spring when you move between steps, and the illustration for that step sliding and scaling in beneath it, with sparkles that twinkle in code. The images stay flat and the motion comes from the app.
