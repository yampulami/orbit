---
target: the rebuilt feed (UX-first)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 6
target_identity: "file:C:\\Users\\yamii\\OneDrive\\Desktop\\CS CAPSTONE CODEX\\web\\src\\pages\\Feed.tsx"
target_fingerprint: "sha256:feb89bfd4299bf825321efa95ff773bbc4dd101a55132bc3c24f66fdbbfc7210"
target_path: "C:\\Users\\yamii\\OneDrive\\Desktop\\CS CAPSTONE CODEX\\web\\src\\pages\\Feed.tsx"
timestamp: 2026-10-31T04-31-40Z
slug: web-src-pages-feed-tsx
---
Method: dual-agent (A: UX-first design review, scenarios, 1440/390, dark and light · B: detector + browser measurements incl. keyboard path)

# Orbit Feed after the rebuild (branch feed, uncommitted), UX-first critique

Score 24/40. Can a student tell what is going on from the Feed alone? Partly: they see their own day and what is on campus, but not what the screen is, how the bands relate, or whether a tap is private or public.

Top problems
- P1 The Feed is unnamed: no visible heading says this is Caldwell's feed; posts start 846px down at 1440 and 1033px down at 390; Now header answers "my day" not "campus".
- P1 Filter vocabulary: "All 24" vs "Everyone 23"; "Marketplace" is a post type shown as an audience ("for Marketplace"); three dead zero-count pills; "Who it's for" is jargon; counts cover only the newest 50.
- P1 Day bar has no key (solid = class, accent = plan/event, needle = now); no needle before 7 AM or after 11 PM.
- P1 Late-night wording flips at midnight ("Tomorrow starts at" before, "Today starts at" after).
- P1 The same dinner appears three times (headline, bar, "You're in for").
- P1 "Add to my week" joins the public going count; "Same" is cryptic; "Plan a hangout" lands on a groups list; the three header links look like plain text.
- P2 Composer looks like no input; no audience cue; no post confirmation. Answer rows lack sender, conflict check and feedback; "Cancel this plan" appears in the answer row. Phone: first post over a screen down, compose button covers event text, Yours today and Calendar missing, filter tabs cut off. Reply/comment vocabulary mixed. Safety menu 30px and unlabelled. Targets: 130 of 169 under 44px at 390.

Measurements: detector 0 static; overlay: straggler on event meta line at 390, glow flag on body (likely false positive). Contrast: 0 failures (lowest 4.67). No overflow. 6 Tab presses to the first Add to my week, 9 to the composer, 12 to the filter, 21 to the first Reply at 1440 (plus 17 sidebar and top-bar stops). Each post costs 6 Tab stops. Textarea has no focus outline.

Reads human: plain-language headline, day words, plans and events apart from posts, empty-state copy. Reads generic: three underlined links under a hero sentence, repeated outline "Add to my week" buttons, initial-in-circle avatars, Yours today card.
