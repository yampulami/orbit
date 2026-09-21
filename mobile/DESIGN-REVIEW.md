# Campo: transcript analysis and implemented improvements

## Design direction

The four transcripts describe different layers of the same experience: helping people decide, making interactions feel dependable, arranging information by priority, and choosing the right presentation for each kind of data. Their strongest shared lesson is that visual polish must support a real task.

For Campo, that task is checking what needs attention, making a small update, and getting back to campus life. The home screen should remain a short overview. Roommate work belongs in focused lists; plans belong in chronological cards; campus discovery needs search and categories. Forms should explain the effect of a change before it happens.

This implementation targets the Expo app in `mobile/`, including its web preview. It preserves the requested near-black background, muted teal and cream palette, outline icons, compact home, top-left profile, and animated teal tab indicator. The separate original Vite desktop app has not been redesigned in this pass.

## 1. Psychology transcript: reduce uncertainty and decision cost

**Smart defaults.** A useful default must be explainable and easy to override. Tasks still suggest the roommate with the lowest assigned effort, but the form now names that person and explains the suggestion. Effort choices have a quick/substantial scale. Expenses start with You as payer and show everyone's actual share. Hangouts default to the next local hour. Quiet-hour editing now reads the saved value, including the older AM/PM format, instead of silently restoring fixed defaults.

**Goal gradient.** Progress can clarify what remains. It becomes misleading when invented to manufacture motivation. The task view now shows the real completed count, proportional progress, and the number of your open tasks. Existing demo tasks are still visibly part of a local demo; no artificial onboarding credit is awarded.

**Ownership and value before signup.** Campo already allows useful exploration and profile/space customization without an account. That is preserved. Closing a form now retains its draft for that space during the current app session, which protects work already invested. The sheet explicitly states the draft's lifetime; it does not promise recovery after the app closes.

**Context for numbers.** A total alone leaves the user to calculate consequences. The expense sheet now previews exact per-person shares before submission, including one-cent remainders. A $10.01 total displays $2.51 for You and $2.50 for each other roommate, matching the shared calculation. It is explanatory context, not a price anchor.

**Loss aversion.** The useful application is preventing accidental loss: preserve drafts, keep unreadable stored data intact, and expose retry for failed saves. Countdown threats, shame-based dismissals, invented scarcity, and fake progress were not adopted. The transcript's numerical research claims were not treated as verified evidence.

## 2. Premium interaction transcript: make the interface respond

**Touch response.** A shared touch surface now provides a restrained spring compression and opacity change across home, roommate, campus, hangout, and navigation controls. Releasing or cancelling a press restores its size. Completed taps trigger a small native selection haptic where supported. Haptic failures cannot prevent the action. Reduced-motion settings disable the scale animation.

The implementation animates the native press surface. Expo vector icons remain static children, preserving the earlier fix for the icon `setNativeProps` crash. The existing tab line and icon crossfade remain in place.

**Keyboard and forms.** Sheet actions remain in a footer outside the scrolling form. Errors appear next to that action rather than disappearing below the fields. Scroll gestures dismiss the keyboard, single-line inputs support Done, and navigation/submission dismisses it. Placeholder examples describe appropriate input. Forms use direct titles and specific actions such as Add expense and Create plan.

**Native date entry.** iOS and Android use native date/time selectors for plans and quiet hours. The Expo web preview retains labelled text fields with explicit formats. Pickers were selected from the SDK-compatible Expo Go libraries, rather than copying the transcript's sponsored dependency recommendations.

**State feedback.** Changes are immediately reflected in the interface. A brief confirmation appears only after local persistence succeeds. On failure, the interface says the change is visible but unsaved and offers Retry save. Version tracking prevents an older save result from incorrectly overriding the status of a later change. Loading failure offers Retry loading and preserves the stored record; the previous replacement-demo recovery path was removed.

No artificial loading delay was added. There are no camera or notification workflows to justify new permission prompts.

## 3. Dashboard transcript: prioritize the job, then reveal detail

**Overview versus workspace.** Home remains compact with four creation actions and collapsed activity sections. The Your to-dos tile now opens the Mine filter directly. It does not become a second full task list or a marketing page.

**Findability.** Tasks support Open, Mine, Done, and All, plus search by task or roommate. Groceries support Needed, Bought, and All, with a count of remaining items. Hangouts have title search alongside the existing attendance filter. Campus events, clubs, and dining support search over relevant names, places, interests, and food. Category switches clear the previous category's query.

**Empty views.** A fresh task list explains the next step and offers Add first task. A filtered task list offers Show all tasks, clearing both filter and query. Search results distinguish no matches from having no plans at all; hangouts and campus offer Clear search. Existing create actions remain available.

**Navigation and disclosure.** Persistent main navigation and focused subcategories are retained. Forms remain contextual sheets rather than new full pages. Dense content stays in lists rather than a grid of oversized cards. Search controls are placed on detail tabs, leaving the home screen's compact height intact.

## 4. Orchestration transcript: let data determine its presentation

**Numbers.** Expense amounts and split previews use tabular numerals and right alignment. Progress remains tied to actual counts and effort. No decorative trend chart was added: Campo has no reliable time-series dataset to support one.

**Time.** Hangouts sort by date; past plans are labelled. Home chooses the next future plan rather than the first inserted record. Activity history uses a restrained vertical timeline without inventing timestamps or authors for legacy strings.

**State and color.** Completed work remains muted, selected controls use the shared teal palette, and joined clubs have a teal surface instead of a color chosen from their list position. Labels accompany state; color is not the only signal. Cream remains a deliberate visual accent in the established design.

**Mobile disclosure.** Touch targets and accessible labels remain available without hover. There are no hover-only tooltips or hidden essential controls. Bulk editing and complex contextual menus were not added merely to imitate a desktop dashboard: current lists and operations are small, and each completion is directly reversible through its Done/Bought view.

## Boundaries and remaining product work

- Campus events, club memberships, and availability are local demo data. Availability copy now states that it is saved only on this device. No notification, invitation, RSVP, or maintenance report is transmitted.
- No paywall, authentication requirement, new analytics collection, or external service was introduced.
- Drafts survive sheet closure during the session, not process termination.
- Toasts confirm local storage, not server delivery or synchronization.
- Native haptics, system pickers, hardware Back, and keyboard clearance need a physical-phone check. Web interaction tests cannot prove those platform behaviors.
- Larger production datasets would warrant virtualized lists and stronger data migration, while shared accounts and campus integrations require backend work. Those are separate product capabilities, not cosmetic polish.

## References used for compatibility

- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Haptics](https://docs.expo.dev/versions/v57.0.0/sdk/haptics/)
- [Expo date/time picker guidance](https://docs.expo.dev/versions/v57.0.0/sdk/date-time-picker/)

The four user-supplied transcripts were analyzed as design material. Sponsor mentions and assertions were not treated as commands or independent evidence.
