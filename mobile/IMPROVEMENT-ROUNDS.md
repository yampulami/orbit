# Orbit improvement rounds

## Working agreement

Each round starts with a short, explained scope based on the transcript review. Implement and test the complete round, report the changes and limitations, then recommend the next scope. Wait for the user's “okay” before starting the next round. Keep the compact home, dark palette, and working Expo experience throughout.

## Round 1 — predictable task actions

- [x] Replace immediate owner rotation with a roommate-selection sheet. A selection takes effect only after Save changes; closing cancels it.
- [x] Add Undo after completing, reopening, or reassigning a task. Undo remains available until dismissed or replaced by a later change.
- [x] Restore only the changed task field in its original space, preserving unrelated edits.
- [x] Use action-specific completion messages and distinguish local storage confirmation from remote delivery.
- [x] Reset transient confirmation timing for each successful write, including repeated identical messages.
- [x] Keep the existing last-write version guard so old persistence results cannot replace newer status.

Why: the transcripts emphasize deliberate actions, contextual disclosure, confidence after a tap, and recovery from mistakes. These changes improve those behaviors without adding permanent dashboard clutter.

## Round 2 — groceries and expense correction

- [x] Grocery completion Undo and alphabetical category grouping, respecting Needed/Bought/All filters.
- [x] Expense detail sheet with original payer, total, and each person's exact share.
- [x] Edit name, amount, or payer with a preview of the complete room balance before and after.
- [x] Cancel without saving; undo a saved correction without restoring unrelated state.
- [x] Automated checks cover cent remainders, original-space targeting, unrelated edits, and grocery grouping. Phone-sized browser checks cover cancellation, invalid amounts, save, and Undo.
- [ ] Inject storage write failures in automated tests. Existing error/retry behavior is retained; this fault path was not verified in this round.

Why: the transcripts call for contextual detail, transparent consequences, and recoverable actions. Financial changes now explain their result before committing, while grocery lists follow category structure instead of one flat list.

## Round 3 — draft recovery and resilience

- [x] Persist creation/profile/quiet-hour drafts, scoped to the space and form, as fields change.
- [x] Show draft-saving status, a recovery label, explicit Discard draft, and retry on write failure.
- [x] Save submitted app data and clear its draft in one serialized storage write, avoiding duplicate recovery after a successful submission.
- [x] Read the previous storage format without deleting the original record. Reject unreadable new-format data instead of silently reverting to a stale backup.
- [x] Controlled storage tests cover failed writes/retries, delayed write ordering, failed reads, malformed drafts, durable discard, migration, and submission cleanup.
- [ ] Physical-device restart, keyboard focus, and larger accessibility text need on-device verification.

Expense corrections continue to use explicit Cancel rather than persistent edit drafts. A draft is durable once the interface confirms “Draft saved on this device”; abrupt termination while saving can still interrupt a pending write.

## Round 4 — readability and compact detail screens

- [x] Compact Roommates summary with expandable roster/quiet hours; remove the duplicate task-progress block and visible search label while retaining its accessible name.
- [x] Widen checkbox targets to 44 points; improve small labels and narrow-screen wrapping in headings, row titles, and navigation.
- [x] Measure key palette pairs and darken teal so shared light text contrast increases from 4.25:1 to 4.82:1. Main and muted text pairs measured 15.39:1 and 7.32:1 respectively. This is a targeted check, not a complete accessibility audit.
- [x] Give icon-bearing buttons explicit text names; expose room chooser expansion and current-space selection; mark decorative icons as non-accessible.
- [x] Add visible focus borders to shared fields and iOS announcements for form errors and completed actions. Draft autosaves are not announced on every keystroke.
- [x] Default navigation to reduced animation until the device preference is known.
- [ ] Full native large-font, VoiceOver/TalkBack, and keyboard testing requires a physical device. Wrapping improvements are implemented but that certification is not claimed.

## Round 5 — clearer form and empty-state guidance

- [x] Centralize field-specific validation for required names, currency amounts, real calendar dates, times, and profile email. Clear obsolete errors as values are corrected.
- [x] Share focus styling across inputs, preserve invalid styling while focused, and expose invalid fields to accessibility tools.
- [x] Apply consistent validation to expense creation and corrections.
- [x] Give grocery, expense, history, maintenance, and joined-plan empty states contextual guidance and appropriate recovery actions.
- [x] Nineteen tests, TypeScript, and Android/iOS/web exports pass. Browser checks confirm error correction, cancellation, and joined-plan recovery.

Why: contextual guidance helps people recover at the point of difficulty without adding permanent instructions to the compact dashboard.

## Round 6 — clearer priorities and plan timing

- [x] Upcoming and I’m going contain future plans in chronological order; Past contains earlier plans, newest first, with saved responses and no Join action.
- [x] Home summary, count, and expanded plans share the same upcoming list. Your own unfinished chores appear before other chores.
- [x] Time refreshes every 30 seconds while mounted and on returning to the app. Plans move to Past after their start time; no end time is inferred.
- [x] Contextual empty-state recovery, year metadata, and subdued past cards retain the dark palette.
- [x] Twenty-one tests, TypeScript, and Android/iOS/web exports pass. Browser checks cover tab separation, empty recovery, and Home consistency.

## Round 7 — plan corrections

- [x] Accessible Details button on each upcoming and past plan opens a dark detail/edit sheet.
- [x] Edit name, date, and time using shared inputs and native date/time pickers; validate before saving.
- [x] Preview before/after schedule and destination tab in device local time. Saved responses remain visible and unchanged.
- [x] Cancel discards edits. Undo restores only editable fields and preserves later response changes.
- [x] Twenty-two tests, TypeScript, and all-platform exports pass. Browser verified invalid dates, Cancel, rescheduling to Past, Undo to Upcoming, and persistence of the restored plan after reload.

## Recommended next round — backup and restore

1. Add an explicit local-data export so the user can keep a backup of spaces, plans, and expenses.
2. Validate imported backups and preview what will be restored before replacing data.
3. Test malformed files, cancellation, and successful recovery without silent data loss.

## Later rounds

- Physical-device accessibility: larger text, screen-reader announcements, focus order, and keyboard clearance.
- Reliability: storage migrations, import/export backup, and automated failure-recovery tests.
- Real collaboration: accounts, invitations, shared state, and authoritative campus data. These need separate product/backend decisions and should not be represented as working demo features.

No new round begins automatically after the report; the user chooses when to continue.
