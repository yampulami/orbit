---
target: the marketplace tab
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\yamii\\OneDrive\\Desktop\\CS CAPSTONE CODEX\\web\\src\\components\\Marketplace.tsx"
target_fingerprint: "sha256:794a63f844ffc532f76c750eba3175957706412e029d6702dc017b02e36d3dcc"
target_path: "C:\\Users\\yamii\\OneDrive\\Desktop\\CS CAPSTONE CODEX\\web\\src\\components\\Marketplace.tsx"
timestamp: 2026-11-13T04-38-12Z
slug: web-src-components-marketplace-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector sub-agent)

Target: web/src/components/Marketplace.tsx (Marketplace tab, demo build, desktop 1024 and phone 375)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Heading stays "Today's picks" under Wanted/For sale; result counts not announced; demo saves not labelled on-device |
| 2 | Match System / Real World | 3 | Kind-aware verbs are good; "$40 Wanted" reads as an asking price, not a budget |
| 3 | User Control and Freedom | 1 | Escape/X/backdrop discards the composer draft; Take down is instant with no undo |
| 4 | Consistency and Standards | 2 | Heart on cards vs Bookmark in rail and detail for the same Saved; 40px vs 44px controls |
| 5 | Error Prevention | 2 | Title cut silently at 80 chars; price placeholder "25" looks filled; category preset to Other |
| 6 | Recognition Rather Than Recall | 3 | Rail counts and the composer's live preview |
| 7 | Flexibility and Efficiency | 2 | Price filter hidden on phones; filters not remembered; counts ignore search |
| 8 | Aesthetic and Minimalist Design | 3 | Calm, but the rail is ~1.5 screens tall for 5 listings |
| 9 | Error Recovery | 1 | Demo Message seller says "Try again" but can never work; demo Report says "Report sent" |
| 10 | Help and Documentation | 2 | Safety line only on the grid, none in the detail view |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict
Generic marketplace skeleton (filter rail + square grid, price/title/name-time); campus character lives only in seed copy. No-photo listings render as identical grey icon tiles. "Today's picks" is template copy. DESIGN.md (cream pastel, DM Sans) no longer matches the shipped dark/orange Bricolage+Hanken world.
Detector: CLI 0 findings (Marketplace.tsx, MarketplacePage.tsx, Attach.tsx, MediaImage.tsx). Browser: first-viewport column overflow (.mk-layout, rail 142% vs grid 96% of viewport), skipped heading level (h1 → h3 rail headings before first h2), glow shadow (false positive: global orb styles).

## Priority Issues
1. [P1] Demo dead-ends and an untrue toast: Message seller fails with a retry that can't work; Report says sent but sends nothing (listings.ts:182); seeded people unlabeled. Fix: label sample listings, demo-aware Message seller and Report copy. harden, clarify.
2. [P1] Nothing is recoverable: composer close discards draft (Marketplace.tsx:232), Take down instant (:200), focus lost on modal close. Fix: per-user draft, undo toast, restore focus. harden.
3. [P1] No safety, trust or place at the decision point: detail view has no meeting guidance, no "not verified" note, no pickup spot. Fix: safety block above the CTA, optional Pickup spot field. clarify, shape.
4. [P2] Looks like any marketplace: grey icon covers, "Today's picks" in every state (:46), Wanted styled as a sale. Fix: tinted per-category covers with the title, state-true headings, distinct Wanted card ("Budget $40"). bolder, typeset.
5. [P2] Layout: desktop rail pushes the fold (detector agrees); phone has four control rows above the first card, orb covers first card title, labels wrap, 36px heart. Fix: Filters sheet on phone, shorter labels, keep orb off content, 44px targets, fix heading order. adapt, layout.

## Persona Red Flags
Casey: orb covers first card; swipe-away deletes draft; lots of scroll to listings.
Riley: silent title truncation; counts disagree with search; failed save toggles silent.
Jordan: "Today's picks" implies curation; Heart vs Bookmark; "$40 Wanted" reads as price; first real action errors in demo.
First-year resident: no pickup spot field; no "not verified" note; take-down not undoable; no move-out framing.

## Minor Observations
Save buttons all named "Save this listing"; aria-hidden={false} no-op (:85); duplicate "Category" labels; dead .mk-* rules in styles.css; orange means both kind tag and Report; "SUNY System" shown as a campus; empty search doesn't offer "Post a Wanted".

## Questions to Consider
Should a listing have a place as a first-class field? Should Wanted be its own board? What if the marketplace were built around move-in and move-out weeks?
