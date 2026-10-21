import { useSyncExternalStore } from "react";
import { loadProfile, saveProfile, type Profile } from "./profile";

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
  saveProfile(userId, { ...p, nudges: { ...p.nudges, [key]: value } });
  version++;
  subs.forEach((f) => f());
}

export function useNudges(userId?: string): Nudges {
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => version);
  return getNudges(userId);
}
