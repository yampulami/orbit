---
target: campus tab
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Users\\yamii\\OneDrive\\Desktop\\CS CAPSTONE CODEX\\web\\src\\pages\\Campus.tsx"
target_fingerprint: "sha256:23ad379a8e5a23934a210d74b83e46c0682f54594e37a8743c1ca6df9601b74d"
target_path: "C:\\Users\\yamii\\OneDrive\\Desktop\\CS CAPSTONE CODEX\\web\\src\\pages\\Campus.tsx"
timestamp: 2026-11-03T01-18-34Z
slug: web-src-pages-campus-tsx
closed: true
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|------:|-----------|
| 1 | Visibility of System Status | 3 | Loading, disabled filters, event state, and role gating are clear; the club rail menu gives weaker focus/open feedback. |
| 2 | Match System / Real World | 2 | Most language is natural, but the live empty state says both “joined every club” and “start the first club,” while mobile copy still says “on the left.” |
| 3 | User Control and Freedom | 3 | Filters can reset, forms cancel, RSVP toggles, and cancellation is confirmed; the custom start menu lacks complete dismissal/focus behavior. |
| 4 | Consistency and Standards | 2 | Tabs and filters share nearly identical underline treatments, and the flat pass conflicts with Orbit’s documented community-color language. |
| 5 | Error Prevention | 3 | Role gates, disabled empty filters, field limits, and cancellation confirmation prevent common mistakes. |
| 6 | Recognition Rather Than Recall | 2 | Club destinations rely on initials/icons and hover tooltips; explanations appear after users meet unfamiliar concepts. |
| 7 | Flexibility and Efficiency | 2 | Club search helps, but event discovery lacks search, sort, calendar/map, or a local accelerator path. |
| 8 | Aesthetic and Minimalist Design | 2 | Clean but over-flattened: headings, filters, badges, rows, and actions compete at similar weight. |
| 9 | Error Recognition and Recovery | 3 | Inline check-in errors and explicit event states are helpful; destructive cancellation explains the consequence before execution. |
| 10 | Help and Documentation | 2 | “Events or hangouts?” is useful but late, and clubs/circles plus the icon rail lack comparable contextual help. |
| **Total** |  | **24/40** | **Acceptable — a solid content model with significant discovery and presentation issues.** |

## Design Specificity Verdict

**LLM assessment:** The concept is unmistakably Orbit: a personal club rail, campus-scoped discovery, truthful official/student provenance, “Up next,” and club-versus-circle distinctions. The implementation is less distinctive. Its late CSS overrides reduce event cards, filters, tabs, badges, and club rows to ruled lines and understated underlines. Most meaningful Pastel Common Room color disappears outside small club marks, so the page reads like a generic directory or student portal rather than the social pulse of campus.

**Deterministic scan:** The detector returned exit code 0 and `[]`: zero mechanical findings in `web/src/pages/Campus.tsx`, with no false positives. This is useful but incomplete. The live browser pass caught problems static rules could not: desktop sidebar overlap, contradictory empty-state copy, and desktop-specific directional copy on mobile.

**Visual overlays:** No reliable user-visible overlay is available. The browser’s evaluation surface was read-only, so mutable injection could not pass preflight. Fallback evidence came from live desktop/mobile screenshots, accessibility trees, DOM layout measurements, console logs, and source-line confirmation.

## Overall Impression

Campus has unusually responsible product logic: it tells the truth about provenance, gates roles carefully, and models event states well. But its first impression is weaker than its data. The biggest opportunity is to turn it from a clean records directory into a confident answer to “what should I do on campus next?” without sacrificing truthfulness.

## What’s Working

1. **Trust is designed into the content.** Official, student, pending, cancelled, and attendance states are explicit instead of implying partnerships or certainty Orbit does not have.
2. **“Up next” and date grouping are the right structural backbone.** They follow a student’s natural temporal scan and can become the signature Campus interaction.
3. **Responsive containment and basic control sizing are sound.** The live 390×844 view had no horizontal overflow, and the inspected primary controls met the 44px target floor.

## Cognitive Load

Moderate: 3 of 8 checks fail.

- **Single focus:** the opening area asks users to process the club rail, Discover/Review, create, a count headline, Events/Clubs, invitations, posting, and filters together.
- **Minimal choices:** five peer event filters are visible at once, while club categories can grow without a grouping threshold.
- **Progressive disclosure:** event rows can accumulate provenance, countdown, check-in, host, time/place, description, attendance, RSVP, report, moderation, and cancellation controls.
- The clearest decision points above four options are the five event filters and any category row with more than four categories.
- Working-memory burden is otherwise controlled because counts, selected filters, and current club search/filter context remain visible.

## Emotional Journey

The count sentence and “Up next” create anticipation, then the energy drops when every event becomes a visually similar ruled row. RSVP and check-in should be satisfying completion moments, but they are buried among secondary actions. The page ends with history and explanation, so the final feeling is administrative rather than social or anticipatory.

## Priority Issues

### [P1] The desktop sidebar obscures Campus content

**Why it matters:** At 1280px, the fixed expanded sidebar occupies roughly x=20–240 while `.campus-shell` begins at x=112. The live headline and empty-state copy were visibly clipped behind navigation. This breaks scanning before the user interacts.

**Fix:** Make the Campus content offset derive from the actual expanded/collapsed navigation width, or constrain the shared app layout so page content never begins beneath the fixed rail. Verify both nav states at 1280px and the next breakpoint.

**Suggested command:** `$impeccable adapt`

### [P1] The default Clubs empty state contradicts itself

**Why it matters:** A guest can see “You have joined every club” immediately above “Nothing here yet…start the first club or circle.” This damages trust at the exact moment the product has the least evidence to establish credibility.

**Fix:** Distinguish three states: no campus organizations exist; organizations exist but the student joined all; organizations exist and some remain to join. Make the headline and action derive from the same state model, and remove “on the left” from responsive copy.

**Suggested command:** `$impeccable harden`

### [P1] Event discovery is organized by attributes, not student intent

**Why it matters:** “All / Today / This week / I am going / Official” exposes system categories. A student looking for something free, nearby, tonight, social, or attended by friends must scan dense rows. The tab counts records instead of resolving intent.

**Fix:** Lead with one compact intent path such as Tonight, This weekend, and Near me/on map, or a search affordance. Keep official and going as secondary refinements. Let an event row open a focused detail surface so the list can stay decisional rather than operational.

**Suggested command:** `$impeccable shape`

### [P1] The club rail is not learnable on touch

**Why it matters:** Discover, Review, club destinations, pending status, and Start are central navigation but are conveyed mainly by symbols, initials, hover tooltips, and a dot. Hover disappears on phones, where the rail becomes horizontal and competes with page tabs and filters.

**Fix:** Keep persistent short labels for Discover, Review, and Start on phone; show the selected club name beside the rail on desktop; state pending membership in the destination instead of relying on a dot. Implement complete Escape, focus-transfer, and focus-return behavior for the start menu.

**Suggested command:** `$impeccable adapt`

### [P2] The visual pass flattened away Orbit’s hierarchy

**Why it matters:** Event rows, club rows, tabs, filters, and badges converge on small gray text, thin rules, and modest corners. The page is tidy but interchangeable, and users must read rather than recognize what matters.

**Fix:** Give “Up next” one unmistakable signature treatment, restore restrained community-coded color to meaningful host/club markers, and subordinate ordinary rows. Keep the page mostly flat; do not turn every item back into a card.

**Suggested command:** `$impeccable bolder`

## Persona Red Flags

**Jordan — first-timer:** The compass, shield, initials, pending dot, and plus rail do not explain themselves without hover. “Circle” appears before its late explanation, and the first action is ambiguous: switch tabs, choose one of five filters, open a club, or start something. The contradictory empty state makes the system feel unreliable.

**Sam — accessibility-dependent:** Accessible names are present on inspected icon controls, but tab semantics lack associated panels/arrow-key behavior, the custom menu lacks a complete keyboard pattern, and dense event rows can create long linear tab sequences. The pending dot is hidden from assistive technology rather than expressed as status text.

**Casey — distracted mobile student:** The horizontal club rail, top-level tabs, and filters consume attention before content. The copy says “Tap + on the left” although the control is near the top, and high-value event actions compete with many secondary row controls instead of one thumb-friendly entry point.

## Minor Observations

- “N clubs and circles to join” is truthful but weak motivation; one relevant named recommendation would be more actionable.
- “You are in [club links] and N more” duplicates the rail rather than improving orientation.
- Disabled zero-count filters are honest but still add visual weight.
- The demo-mode native `<select>` conflicts with the documented themed-picker rule, though its low placement keeps demo mechanics out of the primary flow.
- Event/Club `role="tab"` behavior and the start `role="menu"` should either implement their full ARIA interaction patterns or use simpler semantics.

## Questions to Consider

- What if the first viewport answered “What should I do next?” rather than “How many records exist?”
- Should the club rail be a personal dock, or primary navigation? Its label strategy depends on that decision.
- Is Orbit’s unmistakable Campus moment “Up next,” friend presence, or community identity—and why is it quieter than the filter chrome?
