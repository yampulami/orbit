# Orbit on your phone

Native React Native + Expo SDK 57 app for Android and iPhone. It uses Expo Go-compatible libraries, safe-area insets, keyboard-aware forms, and device storage.

## Start

1. Install or update **Expo Go** on your phone: https://expo.dev/go (select SDK 57).
2. Sign in to Expo Go on your phone. On the computer, run `npx.cmd expo login --browser` from the `mobile` folder and sign in with the **same Expo account**. SDK 57 Expo Go on iPhone requires both logins. Verify the CLI login with `npx.cmd expo whoami`.
3. Connect your phone and computer to the same Wi-Fi.
4. Double-click `START-PHONE.cmd` in the parent folder, or run this in PowerShell:

```powershell
cd "C:\Users\yamii\OneDrive\Desktop\CS CAPSTONE CODEX"
npm.cmd run mobile
```

5. Leave the terminal running. Scan its QR code with the iPhone Camera app, or Expo Go's QR scanner on Android. If the server was started before signing in, restart it after login and scan the new QR.

For a fresh checkout, run `npm.cmd install` in both the root and `mobile` folders first. To start directly here, use `npx.cmd expo start --go --lan`.

**Do not use `127.0.0.1:5173` on the phone.** That is the Vite website on your computer. The native app uses the Expo QR / `exp://` address, normally on port 8081.

If same-Wi-Fi scanning fails (common on university Wi-Fi), stop the LAN server with Ctrl+C and run `npm.cmd run mobile:tunnel` from the parent folder. Expo may ask to install its tunnel helper. Tunnel mode exposes the development server through a temporary public URL; keep the link private. Alternatively, use a trusted home network. No firewall settings are changed by the project.

## Implemented

- Home dashboard and native bottom tabs
- Independent roommate spaces
- Chore creation, completion, reassignment, and effort-based allocation
- Grocery creation, categories, and check-off
- Equal expense splitting and balances, using the same cent-accurate model as the website
- Fairness view, activity history, concerns, maintenance notes, and quiet hours
- Hangout creation, votes, group overlap, and free status
- Sample event RSVPs, club memberships, vegetarian menu filtering
- Local profile preferences with university-scoped shared feed membership
- Shared campus posts, replies, likes, poll votes, and event registrations through Supabase
- Realtime feed updates and pull-to-refresh across signed-in devices
- Private university-scoped photo/video attachments
- Realtime campus group chats with a shared Campus Lounge
- Serialized AsyncStorage persistence, with loading and storage error feedback

This is a native implementation, not an embedded website. Phone and web demo data are separate. The live campus features use the migrations under `supabase/migrations`. Profile preferences, roommate data, personal hangouts, and marketplace seller chat are not synced yet. Invitations, payments, safety reporting, room reservations, and jobs still require additional integrations. The native prototype does not yet expose the website's expense/grocery deletion controls.

## Development

```powershell
npm.cmd run typecheck
npx.cmd expo-doctor
npm.cmd run export
npm.cmd run web
```

`src/Orbit.tsx` contains native screens. `src/storage.ts` owns on-device persistence. `../src/model.ts` is the shared business logic; Metro watches that folder. UUIDs are supplied by Expo Crypto on native rather than relying on the browser crypto global.

Expo Go does not require a local iOS build on Windows. Standalone signed app builds are a separate deployment step. See https://docs.expo.dev/tutorial/create-your-first-app/ for the official device setup instructions.
