import type { Living, Tenure } from "./profile";

/** What Orbit will actually do with each answer from setup, in words, shown beside the questions so every answer visibly pays off.
 *  Each line states a real behaviour: the first one mirrors how the Home feed picks its default audience (see FOR_YOU in pages/Feed.tsx),
 *  so if that mapping changes, change this in the same commit. */
export function homeLine(living: Living | null): string {
  switch (living) {
    case "residence": return "Home opens on posts for everyone, things for sale, and what residents and roommates share.";
    case "commute":
    case "off-campus": return "Home opens on posts for everyone, things for sale, and what commuters share.";
    case "other": return "Home opens on everything on your campus, newest first.";
    default: return "Home will be tuned to where you live.";
  }
}

export const TENURE_LABEL: Record<Tenure, string> = {
  "first-semester": "First semester", "first-year": "First year", "second-year": "Second year", "third-year": "Third year", "fourth-plus": "Fourth year or longer", graduate: "Graduate student",
};

export function interestsLine(interests: string[]): string {
  if (interests.length === 0) return "No picks yet. Your feed will simply be newest first.";
  const list = interests.length <= 2 ? interests.join(" and ") : `${interests.slice(0, 2).join(", ")} and ${interests.length - 2} more`;
  return `Your For you feed leans toward ${list.toLowerCase()}.`;
}

/** The short sentence under the card for the screen you are on. */
export function stepNote(step: "campus" | "you" | "life" | "interests", campus?: string): string {
  switch (step) {
    case "campus": return campus ? `Your feed, events and map will only show students and things at ${campus}.` : "Your feed, events and map are limited to the university you pick.";
    case "you": return "This is how other students on your campus will find you and see you.";
    case "life": return "Your standing is never shown to anyone else. Where you live only tunes what Home shows first.";
    case "interests": return "Optional. Change any of this later in Profile.";
  }
}
