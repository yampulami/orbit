# Verification

- TypeScript check passed.
- Expo SDK dependency compatibility check passed.
- Expo Doctor: 21/21 checks passed.
- Android and iOS Hermes bundles and web bundle exported successfully.
- Existing web production build and all five shared model tests passed.
- Expo web preview tested at phone size: space creation, empty independent space, $10.01 expense split ($7.50 owed to payer), and persistence after reload.
- A physical Android or iPhone was not attached; on-device rendering, keyboard behavior, and LAN connectivity still require scanning with Expo Go.

The current npm audit reports eleven moderate entries arising from one transitive `uuid` advisory in Expo's Xcode/config toolchain. No high or critical entries were reported. Track the upstream Expo/Xcode fix before standalone production builds; a forced dependency downgrade was not applied.

The generated `expo-go-qr.png` is a convenience for the current running LAN server only. It becomes stale if the computer's address or Expo port changes. The terminal always displays the current QR code.

## Transcript-driven UX pass — September 15, 2026

- Expo updated to SDK 57.0.23 patch; Expo Doctor passes 21/21.
- TypeScript passes. Seven tests pass across model calculations and quiet-hour conversion (legacy AM/PM, midnight/noon, 24-hour round-trip).
- Final Android, iOS, and web exports pass with native haptics and date picker dependencies.
- Browser preview checked at 375 × 667: home fits without scrolling; dark surfaces and animated navigation retained.
- Verified $10.01 preview distributes $2.51 / $2.50 / $2.50 / $2.50; closing/reopening preserves values; $10.001 submission reports validation without closing.
- Verified Mine task filter, no-match task state and Show all recovery, hangout title search, campus place/interest/food search, no-match recovery, and category query reset.
- Verified storage-success feedback after a local RSVP change and that Going survived a full reload after restarting Metro. Restored the original RSVP afterwards. Save/load failure recovery is implemented but storage faults were not injected in the browser.
- Physical-device haptics, pickers, keyboard avoidance, and cancelled gestures remain to be checked in Expo Go. No physical phone was attached.

See DESIGN-REVIEW.md for the transcript-by-transcript decisions, implemented scope, and deferred product capabilities.

## Round 2 — grocery organization and expense corrections

- Ten shared tests pass, including expense replacement/undo in the original space, exact cent splits, grocery undo preserving unrelated edits, and category grouping without lost items.
- TypeScript check passes.
- At 375 × 667, browser checks verified grocery completion/Undo, expense details, cancellation, amount validation, balance preview crossing from owed-to-you to you-owe, save, and expense Undo. Test grocery and expense values were restored afterwards.
- Example: changing the $68.40 grocery expense paid by You to $10.01 paid by Alex previews the complete room balance moving from $41.30 owed to You to $12.51 owed by You. The existing $40 internet expense is included.
- Native keyboard behavior still needs physical-device testing. Storage fault injection remains outstanding; no new claim of verified failure recovery is made.

## Round 3 — durable drafts and storage recovery

- Sixteen tests pass. Added controlled storage tests for migration, scoped draft recovery, atomic submission cleanup, failed writes and retries, delayed write ordering, durable discard, malformed data, and failed reads.
- TypeScript and iOS/Android/web exports pass.
- At 375 × 667, entered an expense draft, waited for the saved indicator, reloaded the preview, and confirmed the exact title and $12.37 amount recovered. Discarded that test draft, reloaded again, and confirmed blank fields with no recovery label.
- Existing saved demo state remains intact. New writes use a version-2 envelope containing state and drafts; the version-1 record is retained and read only when no version-2 record exists.
- Durable drafts cover the shared creation/profile/quiet-hour forms. Expense correction sheets still intentionally discard unsaved edits when Cancel is pressed.
- Failure tests exercise the storage layer with a controlled adapter; actual device disk failures and physical-phone process termination were not tested.
- Network address changed; the refreshed `expo-go-qr-current.png` points to exp://172.27.17.238:8083. It remains valid only while that address and server port are current.

## Round 4 — readability and compact layouts

- TypeScript and iOS/Android/web exports pass.
- Browser layout reviewed at 375 × 667 and 320 × 667. Room details expand/collapse; task titles wrap on the narrower screen; checkbox controls retain 44-point minimum width and height.
- Removed duplicate task progress from the detail area; the room summary still shows completed/total chores.
- Contrast values calculated from the shared foreground/background colors: main text on background 15.39:1, muted text on surface 7.32:1, light text on updated teal 4.82:1, active teal on background 8.79:1. Hardcoded colors and all interaction states were not comprehensively audited.
- Native text scaling, screen-reader announcements, and software-keyboard clearance remain unverified on a physical phone. Browser width testing is not a substitute for those checks.

## Round 5 — form guidance and empty states — September 17, 2026

- Nineteen automated tests pass, including currency boundaries, leap dates, field-specific errors, and correction behavior. TypeScript and Android/iOS/web exports pass.
- Browser checks verify required expense title feedback, amount feedback after entering the title, and clearing errors after a valid amount.
- Expense correction check: $10.001 shows an amount alert and aria-invalid=true; changing to $10.01 clears the alert and invalid flag. Cancel preserves the original $68.40 expense.
- The empty joined-plan list offers Browse all plans; clicking it restores the plan list. Preview returned to Home without saving test changes.
- Physical-phone keyboard and screen-reader behavior still require device verification.
- Current refreshed QR is expo-go-qr-current.png for exp://192.168.0.146:8083; older recorded addresses are historical.


## Round 6 — plan timing and home priorities — September 17, 2026

- Twenty-one tests pass. New cases cover exact start-time boundaries, explicit time-zone offsets, sorting without mutation, and own unfinished chore priority.
- TypeScript and Android/iOS/web exports pass.
- Browser: Upcoming shows Friday movie night; Past shows Coffee & a study session without Join. Empty I’m going returns to Upcoming through its browse action.
- Home shows one upcoming plan, and its expanded list contains only Friday movie night. No test data was saved.
- Plans are classified by start time, refreshed every 30 seconds and on app foreground. Physical-phone background/resume behavior was not verified.


## Round 7 — plan details and corrections — September 17, 2026

- Twenty-two tests pass. The new plan test verifies rescheduling, field-only Undo, preservation of later participant responses, and unrelated state.
- TypeScript and Android/iOS/web exports pass.
- Browser: invalid February 30 date was rejected; Cancel restored September 18. Saving September 15 moved Friday movie night into Past with all three responses; Undo returned it to Upcoming on September 18.
- After the local save indicator, reloaded and confirmed the restored September 18 date and three responses persisted. Test data restored; preview left on Home.
- Native date picker interaction, keyboard avoidance, and screen-reader behavior need physical-phone testing. Undo is session-only; unsaved plan edits are discarded by Cancel and are not durable drafts.


## Orbit rename — September 20, 2026

- Renamed Expo display name, slug, URL scheme, package names, visible branding, documentation, and main screen module to Orbit.
- New saves use orbit-native-v2 / orbit-v1. Readers retain previous storage-key compatibility and do not delete old records. Recovery requires access to the same device storage; physical Expo Go migration remains unverified.
- Twenty-three tests pass, including old native state/draft recovery, new-key precedence, and corrupt new-record rejection. Vite build, native TypeScript, and Android/iOS/web exports pass.


## Login and onboarding — September 21, 2026

- Read both user-supplied onboarding transcripts before implementation; decisions and backend setup are in AUTH-SETUP.md.
- Twenty-five automated tests pass, including account/preview storage isolation, valid profile shape, multi-interest selection, and commuter/major-based suggestions.
- Vite production build, native TypeScript, and Android/iOS/web exports pass with authentication and development-client dependencies installed.
- Browser verified name validation, four stages, commuter selection, year/major, multi-select interests, personalized summary, entry to commuter Home, persisted setup after reload, and profile editing. Test residence/year/major/interests were cleared afterward; the preview name remains Jamie.
- Phone-size override did not apply to the browser screenshots in this session; observed screenshots were desktop width. Native small-screen, software keyboard, Face ID, biometric cancellation, and background locking remain device verification tasks.
- The local Expo environment is connected to the ORBIT Supabase project with its publishable client key. Email/password sign-up, confirmation guidance, sign-in, session storage, and sign-out are implemented. The provider, new-user signup, and confirmation settings are enabled. No test email was sent and no real user account was created, so delivery, confirmed login, session refresh, and remote sign-out still need an authorized test account. Production delivery needs custom SMTP.
- Face ID requires a signed Orbit development build. Expo Go provides the local onboarding preview; it does not support Face ID on iOS.


## Entry experience redesign — September 22, 2026

- Redesigned email sign-in, account creation, confirmation, password recovery, biometric entry, and all four onboarding stages with shared dark-theme controls.
- 33 automated tests pass, including eight new checks covering bare/expired/unrelated callback URLs, Expo and installed-app paths, recovery classification, and signup versus sign-in password validation.
- Native TypeScript, root Vite build, and iOS/Android/web exports pass.
- Visually reviewed login, signup, interests, and profile review at 390 × 844 and signup at 375 × 667. Primary signup action remains visible on the smaller size; supplementary content scrolls. Native keyboard and font-scaling behavior still need device testing.
- Browser walkthrough: saved draft restored; residence/year/major/interests retained; selected controls expose checked state; review edits jump directly back; completion opens personalized Home; cancelling an existing-profile edit preserves the previous preferences.
- Expired confirmation link shows an error instead of a success claim. Password visibility, signup password-length validation, confirmation navigation, and recovery entry were exercised. No successful live recovery/password change or native biometric flow was verified in this pass.
- Physical iPhone checks remaining: email deep link from Mail, keyboard next/done and avoidance, Face ID success/cancel/background locking in a signed build. Expo Go on iOS cannot verify Face ID.

## Interactive entry refinement — September 22, 2026

- Re-read both supplied onboarding transcripts. Applied live form feedback, showing the effect of preferences, and gentle progress motion. No purchased assets or extra icon libraries are needed.
- Supabase's ambiguous invalid_credentials response now explains that the account may be missing or the password incorrect, with an explicit create-account action preserving the entered email. A definite missing-account message is only used for a definite user_not_found response.
- Signup shows live email-format and password-length checks. Setup animates progress with Reduce Motion support and previews the same plan/club suggestions used by Home as interests change.
- 37 tests pass, TypeScript passes, and iOS/Android/web exports pass. Browser tested a nonexistent reserved-domain login, confirmed its actionable error, and verified the signup action preserved email. Phone-size visual review and live hobby-to-preview updates passed.

## Compact entry and discovery — September 23, 2026

- Removed repetitive login/signup marketing headings. Web entry fields suppress automatic credential population until focused; native credential behavior is unchanged. Reloaded preview showed empty fields, and focusing enabled input.
- Home club suggestions open Clubs directly. Campus ranks sample clubs using selected interests, supports search and saved-only filtering, and labels saving separately from real enrollment. Saved Code Collective survived reload; the temporary save was removed afterward, preserving the original Outdoor Club save.
- Replaced large profile buttons with compact settings rows and readable campus/studies/interests. Increased Home text sizes; upcoming Home plans open details. Selected tabs expose selection state.
- Hangouts search appears before results with specific recovery actions. Browser checked Past plans and no-match search; Dining vegetarian filter correctly reduced three places to two. Reviewed Home, Dining, Hangouts, and Profile at 390 by 844.
- 42 automated tests, mobile TypeScript, root production build, and Android/iOS/web exports pass. Export was performed before final accessibility/style cleanup; final TypeScript and tests include those edits.
- Campus content remains sample data. App activity and profile preferences are local to the device. This pass did not validate live email delivery, native keyboards, or Face ID on a physical phone.
