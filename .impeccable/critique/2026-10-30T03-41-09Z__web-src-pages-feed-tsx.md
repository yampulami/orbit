---
target: the dashboard (Feed)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\yamii\\OneDrive\\Desktop\\CS CAPSTONE CODEX\\web\\src\\pages\\Feed.tsx"
target_fingerprint: "sha256:6214e136372063a068a6a0beb07c0ffaefc6216412e9fd8c70dcc119cd8db89e"
target_path: "C:\\Users\\yamii\\OneDrive\\Desktop\\CS CAPSTONE CODEX\\web\\src\\pages\\Feed.tsx"
timestamp: 2026-10-30T03-41-09Z
slug: web-src-pages-feed-tsx
---
Method: dual-agent (A: design review, 1440 and 390, dark and light · B: detector + browser measurements)

# Orbit Feed (the dashboard), after the restyle

## Score: 26/40 (Acceptable to Good)
1 Status 3 · 2 Real world 3 · 3 Control 3 · 4 Consistency 2 · 5 Error prevention 3 · 6 Recognition 2 · 7 Efficiency 3 · 8 Minimalism 2 · 9 Error recovery 2 · 10 Help 2

## Specificity
Content is campus-authored (hangouts, events, community taxonomy); the chrome is a well-made generic social dashboard. "Needs your answer" is the real idea and is not the visual lead; the accent is spent on selection state.
Detector: 0 static findings. Live overlay: 3 (straggler "welcome." in event description, coloured glow on the assistant button, radial halo from an orb gradient).

## Priority issues
- [P1] Sticky filter bar collides with the "Feed" title and floats transparent over posts. Fix: opaque background and offset below the title, or stop pinning. /impeccable polish
- [P1] Hangouts band hierarchy: four community tints, the answered "No" is the strongest mark, empty "Needs your answer 0" tab leads. Fix: neutral cards, accent only on unanswered, quiet answered state, default tab All when 0. /impeccable colorize + clarify
- [P1] Touch targets and names: Yes/No 88x28 on desktop, pins 30x30, More options 30x30, 37 person links 20px tall; 20 identical "Comments" names. Fix: 44px hit areas, post-specific labels. /impeccable audit + harden
- [P2] Filter bar overbuilt: icon discs, slow width animation (.85s + .45s delay), "ALL" styled unlike the rest, per-community selected colours, "Marketp" clipped on phone. /impeccable distill + typeset
- [P2] Top of page order: Moments, Next window, hangouts, composer, filters before the first post (about 480px). Fold state shared between phone and desktop. /impeccable layout + distill
- [P3] Empty states: "Nothing in Residents yet." has no action. /impeccable clarify

## Measurements
No unnamed controls, no overflow at 1440 or 390, no console errors, no failed requests. 25 distinct font sizes (9.28px to 48px). Contrast: avatar initials 3.2 to 3.7:1; hangout date line 4.47:1. Light-theme load flagged white Yes/No on card (likely pseudo-element fill, false positive). Focus rings visible (2px, 3px offset).

## Personas
Jordan: "ALL" plus six discs read as decoration; local-only hangouts not labelled. Alex: sticky bar covers title; 20 identical "Comments" buttons. Casey: 28px Yes/No (phone 38px), orb and FAB cover content, "Marketp" clipped. Commuter: Next window and Moments render nothing, no hint they exist.

## Questions
If a student has one thing to do today, why is the top the same size whether or not anything needs them? Should the hangouts, free time and events come before the social feed? What if the accent only ever meant "this needs you"?
