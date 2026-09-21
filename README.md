# Orbit

A campus-life prototype with an Expo / React Native phone app and a React / Vite web prototype. The visual theme uses the supplied reference's deep teal, muted blue, sage, and warm cream.

## Project structure

- `mobile/` — primary Expo app for Android, iOS, and web.
- `src/model.ts`, `src/ux.ts`, `src/localStore.ts` — shared data and behavior.
- `src/App.tsx` — earlier Vite web prototype; its UI differs from the Expo app.
- `mobile/DESIGN-REVIEW.md` — design analysis.
- `mobile/IMPROVEMENT-ROUNDS.md` — completed and planned work.
- `mobile/VERIFICATION.md` — verification history and limitations.

## First-time setup

Use Node.js 22.13 or newer. Install both dependency sets from the repository root:

```powershell
npm.cmd ci
npm.cmd --prefix mobile ci
```

## Run locally

### Phone app (Expo Go)

The native Expo app is in `mobile/`. Double-click `START-PHONE.cmd`, or run `npm.cmd run mobile` from this folder and scan the QR code in Expo Go. Keep your phone and computer on the same Wi-Fi. Install/update Expo Go for SDK 57. See [mobile setup](mobile/README.md) for steps and troubleshooting. Native and web data are stored separately on each device.

### Website

Requires Node.js 22 or newer. From this folder:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. `npm.cmd run build` produces a production bundle in `dist`; `npm.cmd run preview` serves that bundle. `npm.cmd test` runs the shared engine tests.

## Working features

- Responsive dashboard and module navigation
- Multiple independent roommate spaces, using four named demo members
- Chore creation, completion, reassignment, and effort-weighted automatic assignment
- Grocery lists with categories, check-off, and removal
- Equal expense splitting with integer cents and running balances
- Combined effort/balance view, activity history, and concern logging
- Household maintenance notes and editable quiet hours
- Hangout proposals with suggested times, availability votes, overlap detection, and free status
- Sample event RSVPs, club memberships, and vegetarian dining filters
- Editable demo profile with optional `.edu` email format checking
- Local browser persistence under `orbit-v1`

## Prototype boundaries

This is a local, single-device prototype. Sample people, events, menus, and campus details are fictional. No account authentication, email verification, invitations, multi-user sync, payments, university access, emergency reporting, or real bookings are implemented. An email suffix does not verify student identity. The interface labels these boundaries explicitly.

Safety, booking, and jobs are integration placeholders. Later work includes a backend with verified university email authentication, space membership and authorization, real-time updates, receipt uploads, recurring bills, negotiated task trades, grocery trip claiming, availability polls across multiple times, and university-approved integrations. User preference changes on campus preview pages only affect this browser.

The shared living engine is isolated in `src/model.ts`, with no university-specific dependencies. Campus preview data and presentation are in `src/App.tsx`. Local demo members should become per-space memberships when implementing the backend.

Google Fonts are loaded when internet is available; local sans-serif fonts are used otherwise. To reset demo data, clear this site's browser storage. Do not store sensitive information in this prototype.



## Checks

```powershell
npm.cmd test
npm.cmd run mobile:check
npm.cmd --prefix mobile run export
```

## Working with Git

```powershell
git status
git add .
git commit -m "Describe your change"
git push
```

Dependencies, build output, Expo session files, generated LAN QR codes, and environment secrets are excluded from Git. After cloning, start Expo to generate a fresh QR code for your network.
