import { useSyncExternalStore } from "react";
import { loadProfile, pushNudges, saveProfile, type Profile } from "./profile";
import { notice } from "./notice";

/** Which kinds of nudges a student wants, chosen in onboarding and changeable in Profile. They are saved with the profile on this device. */
export type Nudges = Profile["nudges"];
const ALL_ON: Nudges = { hangouts: true, reminders: true, places: true };

let version = 0;
const subs = new Set<() => void>();

export function getNudges(userId?: string): Nudges {
  if (!userId) return ALL_ON;
  return loadProfile(userId)?.nudges ?? ALL_ON;
}

export function setNudge(userId: string, key: keyof Nudges, value: boolean) {
  const p = loadProfile(userId);
  if (!p) return;
  const nudges = { ...p.nudges, [key]: value };
  saveProfile(userId, { ...p, nudges });
  profileChanged();
  // With a database the choice is kept there too, so it follows the student to another device.
  pushNudges(userId, nudges).catch(() => notice.show({ icon: "wifi", title: "That did not save everywhere", message: "Your notification choice is saved on this device, but we could not save it to your account. Check your connection and try again." }));
}

/** Call after the saved profile changed from somewhere else, for example when it was loaded from the database. */
export function profileChanged() {
  version++;
  subs.forEach((f) => f());
}

export function useNudges(userId?: string): Nudges {
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => version);
  return getNudges(userId);
}
