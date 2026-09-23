import type { StudentProfile } from "./studentProfile";

export const campusClubs = [
  {
    name: "Outdoor Club",
    category: "Outdoors",
    description: "Walks, trail days, and time outside.",
    icon: "leaf-outline",
    interests: ["Outdoors", "Sports", "Fitness", "Sports & recreation"],
  },
  {
    name: "Code Collective",
    category: "Technology",
    description: "Build projects and trade ideas with other makers.",
    icon: "code-slash-outline",
    interests: ["Coding", "Technology", "Academic"],
  },
  {
    name: "The Creative Corner",
    category: "Arts & culture",
    description: "Photography, drawing, and making things together.",
    icon: "color-palette-outline",
    interests: ["Art", "Photography", "Arts & culture"],
  },
  {
    name: "Campus Sessions",
    category: "Music",
    description: "Listening sessions, open mics, and jam nights.",
    icon: "musical-notes-outline",
    interests: ["Music", "Arts & culture"],
  },
  {
    name: "Game Night Society",
    category: "Gaming",
    description: "Board games, casual matches, and a regular game night.",
    icon: "game-controller-outline",
    interests: ["Gaming"],
  },
  {
    name: "Community Crew",
    category: "Volunteering",
    description: "Find a small way to help your local community.",
    icon: "heart-outline",
    interests: ["Volunteering", "Student leadership"],
  },
] as const;
export function discoverClubs(
  profile: StudentProfile,
  query: string,
  saved: string[],
  savedOnly: boolean,
) {
  const interests = new Set(
    [...profile.hobbies, ...profile.clubs].map((x) => x.trim().toLowerCase()),
  );
  const search = query.trim().toLowerCase();
  return campusClubs
    .map((club) => ({
      ...club,
      reasons: club.interests.filter((interest) =>
        interests.has(interest.toLowerCase()),
      ),
    }))
    .filter(
      (club) =>
        (!savedOnly || saved.includes(club.name)) &&
        [club.name, club.category, club.description, ...club.interests]
          .join(" ")
          .toLowerCase()
          .includes(search),
    )
    .sort((a, b) => b.reasons.length - a.reasons.length);
}
