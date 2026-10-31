---
target: the home page (landing) and front door
total_score: 16
max_score: 24
na_heuristics: 5,7,9,10
p0_count: 2
p1_count: 5
target_identity: "file:C:\\Users\\yamii\\OneDrive\\Desktop\\CS CAPSTONE CODEX\\web\\src\\pages\\Landing.tsx"
target_fingerprint: "sha256:37ea9ac7a5b9c31e7602e413ba63247989eddad297d48519920c19eb09169df9"
target_path: "C:\\Users\\yamii\\OneDrive\\Desktop\\CS CAPSTONE CODEX\\web\\src\\pages\\Landing.tsx"
timestamp: 2026-10-31T03-41-19Z
slug: web-src-pages-landing-tsx
---
Method: dual-agent (A: design review of landing, login/signup and onboarding · B: detector + browser measurements)

# Orbit landing page (home) and front door

Score: 16/24 on the six heuristics that apply to a landing page (5, 7, 9, 10 n/a). Front-door flow (login, signup, onboarding): 24/40.

Verdict: after the restyle the page is empty rather than specific. One centred headline, three marbled orbs, a four-line feature row, 1004px tall. Brand-swap test fails. The only authored ideas are the eyed orb and the honest footer. Login and onboarding still carry glass, goo blobs, glow underlines, tracked uppercase labels, confetti, 3D tilt and pastel selection, and look like a different product.

Priority issues
- P0 specificity: headline "Campus life, in one place." and subhead are generic. Replace with the real mechanism ("Find the hour you're both free.").
- P0 honesty: "only from your university" / "private to your campus" vs footer "does not verify university enrollment".
- P1 centred hero + three symmetrical orbs + four equal feature row; page ends before it says anything.
- P1 login: centred glass card (blur now over nothing), glow underline inputs sliding 8px on focus, 11px tracked uppercase labels, goo submit button, three different logo marks, primary button colour differs per screen.
- P1 onboarding: 10 steps, confetti on every step, 3D tilt art, per-word headline reveal, pastel selected states (second hue), same bell on every switch, guest path buried.
- P1 "Safety built in ... reporting" may over-promise.
- P2 four names for one action; nav duplicates CTAs; no h2 (h1 then h3); entrance fade hides hero on slow loads; title and meta use em dashes.

Measurements: 0 detector findings static; overlay: skipped heading level. 0 unnamed controls; Terms/Privacy links 19px tall; contrast all pass (lowest 6.4:1); no overflow; 3 WebGL canvases; FCP 1.0 s, LCP 1.05 s; no canonical, no Open Graph tags.

Redesign direction: two-column hero with a live demo week grid running the real freeTime logic, three sample students (labelled sample), one orb, honest status table (shared / only on this device / not built), real screenshots supplied by the owner, a short "who built this".
