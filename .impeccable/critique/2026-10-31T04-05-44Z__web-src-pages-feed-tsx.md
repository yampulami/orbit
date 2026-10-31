---
target: the feed page (thorough, human-authored pass)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 9
target_identity: "file:C:\\Users\\yamii\\OneDrive\\Desktop\\CS CAPSTONE CODEX\\web\\src\\pages\\Feed.tsx"
target_fingerprint: "sha256:569f39d158d636b0a2785233c0985784bf6ef77338749ba450c565728940cec8"
target_path: "C:\\Users\\yamii\\OneDrive\\Desktop\\CS CAPSTONE CODEX\\web\\src\\pages\\Feed.tsx"
timestamp: 2026-10-31T04-05-44Z
slug: web-src-pages-feed-tsx
---
Method: dual-agent (A: thorough live design review, 1440 and 390, dark and light, plus source · B: detector + browser measurements)

# Orbit Feed, second critique (after the restyle and the first round of fixes)

Score 26/40. Detector 0 findings (static and overlay: glow on the assistant button, a radial halo).

Verdict: no longer AI-looking at first glance; structurally still the standard social-feed template. About 55 to 60 percent reads as designed by someone who lives on this campus. The one Orbit-only idea, the free window, is the smallest thing on the page. Brand-swap test partial fail; grayscale test passes weakly; no-data test fails; 8-second test: a student cannot say what is urgent or free.

Real defects found: phone hangouts strip cannot be re-folded (fold, nav, Plan a hangout and streak are display:none at 390); hangout dots are coloured by list position, not group; stray "·" after the hangout chip; Next window says "Nothing is planned until then" while listing a hangout; failed load leaves the skeleton forever; repost is invisible; "Planned by" and Cancel render at 0x0; light-mode active Repost 2.44:1 and Like 2.94:1; "Nov" tile 3.39:1 in light; three compose entries.

Template signals: identical-card hangout carousel; five community pastel tints; icon-disc filter with caps labels; Twitter-style post header and four-icon pill; floating assistant bubble that reads as Pause, with perpetual float and glow; Sparkles tag; streak flame; rolling digits (720 DOM nodes); 22 font sizes, 8 radii, about 10 hues; accent used for six meanings; orange-700 default.

Direction: one "Now" header (free window in 30px Bricolage plus a gap bar on the day), "Plans waiting on you" answer rows, "Today on campus" time-rail events, one-line composer, text filter, ruled 640px post list, end line. Delete list of 14 items. Owner must supply seed data (schedule, sharing friend, unanswered hangout, priced marketplace post, long posts), group colours decision, repost/like decision, accent colour decision.
