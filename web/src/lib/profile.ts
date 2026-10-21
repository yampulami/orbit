/** What a student told us during onboarding. Saved on this device, per account, until a profiles table exists on the server.
 *  The university itself is also saved as the account's campus membership, which is what separates the feed by university. */
export type Tenure = "first-semester" | "first-year" | "second-year" | "third-year" | "fourth-plus" | "graduate";
export type Living = "residence" | "commute" | "off-campus" | "other";
export type Look = "light" | "dark" | "system";

export type Profile = {
  name: string;
  campusName: string;
  campusKey: string;
  campusDomain?: string;
  tenure: Tenure;
  living: Living;
  interests: string[];
  streaks: boolean;
  nudges: { hangouts: boolean; reminders: boolean; places: boolean };
  look: Look;
  doneAt: string;
};

const key = (userId: string) => `orbit-profile-v1:${userId}`;

export function loadProfile(userId: string): Profile | null {
  try { const s = localStorage.getItem(key(userId)); return s ? (JSON.parse(s) as Profile) : null; } catch { return null; }
}
export function saveProfile(userId: string, p: Profile) {
  try { localStorage.setItem(key(userId), JSON.stringify(p)); } catch { /* ignore */ }
}

/** How many years the person has been on campus, 1 to 6, for the orbit rings and for weighting map votes later. */
export const TENURE_YEARS: Record<Tenure, number> = { "first-semester": 1, "first-year": 2, "second-year": 3, "third-year": 4, "fourth-plus": 5, graduate: 6 };
