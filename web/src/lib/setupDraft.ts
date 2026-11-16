import type { Living, Tenure } from "./profile";
import type { University } from "./universities";

/** Setup now comes before the account. The answers are kept on this device as they are given, so a reload, or the trip to the inbox to confirm the
 *  email, does not lose them; when the person comes back signed in, setup opens on its last page with everything filled in. No email or password is kept. */
export type Draft = {
  at: number;
  step: number;
  uni: University | null;
  name: string;
  username: string;
  tenure: Tenure | "";
  living: Living | null;
  interests: string[];
  nudges: { hangouts: boolean; reminders: boolean; places: boolean };
};

const KEY = "orbit-setup-draft";
const HOUR = 3_600_000;

/** Pure: is this draft still worth restoring? Someone not signed in gets a couple of hours (a reload); someone who made an account gets a week
 *  (the email may sit unread for a while). */
export const fresh = (d: Pick<Draft, "at">, now: number, signedIn: boolean) => now - d.at < (signedIn ? 168 : 2) * HOUR;

/** Pure: a draft is complete when everything the last page needs has been answered. */
export const complete = (d: Pick<Draft, "uni" | "tenure" | "living">) => !!d.uni && !!d.tenure && !!d.living;

export function loadDraft(signedIn: boolean): Draft | null {
  try {
    const raw = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || typeof d.at !== "number" || !fresh(d, Date.now(), signedIn)) return null;
    return d;
  } catch { return null; }
}

export function saveDraft(d: Omit<Draft, "at">) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...d, at: Date.now() })); } catch { /* the answers still live on this page */ }
}

export function clearDraft() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ } }
