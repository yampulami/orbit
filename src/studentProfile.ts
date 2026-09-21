export const lifestyles = ["On campus", "Commuter", "Off campus"] as const;
export const years = ["First year", "Sophomore", "Junior", "Senior", "Graduate", "Other"];
export const hobbies = ["Music", "Gaming", "Fitness", "Photography", "Art", "Reading", "Cooking", "Outdoors", "Coding", "Sports"];
export const clubInterests = ["Technology", "Arts & culture", "Academic", "Volunteering", "Sports & recreation", "Student leadership"];
export type StudentProfile = {
  version: 1; name: string; campus: string; lifestyle: string; year: string; major: string;
  hobbies: string[]; clubs: string[]; completed: boolean;
};
export const emptyProfile = (): StudentProfile => ({ version: 1, name: "", campus: "", lifestyle: "", year: "", major: "", hobbies: [], clubs: [], completed: false });
export function validProfile(value: unknown): value is StudentProfile {
  const p = value as StudentProfile;
  return !!p && p.version === 1 && [p.name,p.campus,p.lifestyle,p.year,p.major].every(x => typeof x === "string" && x.length <= 100)
    && [p.hobbies,p.clubs].every(x => Array.isArray(x) && x.length <= 30 && x.every(v => typeof v === "string" && v.length <= 100)) && typeof p.completed === "boolean";
}
export function toggleInterest(values: string[], value: string) { return values.includes(value) ? values.filter(x => x !== value) : [...values,value]; }
export function profileSuggestions(p: StudentProfile) {
  return [
    { title: p.lifestyle === "Commuter" ? "Make the gap between classes count" : "Make a plan with your circle", detail: p.major ? `Start a ${p.major} study session` : "Coffee, a study break, or a shared lunch", destination: "hangouts" },
    { title: p.clubs.includes("Technology") || p.hobbies.includes("Coding") ? "Explore tech clubs" : p.clubs.includes("Arts & culture") || p.hobbies.includes("Art") ? "Find your creative circle" : p.clubs[0] ? `Explore ${p.clubs[0].toLowerCase()}` : "Find a club that fits", detail: p.hobbies.length ? `Inspired by ${p.hobbies.slice(0,3).join(", ")}` : "Browse the campus club preview", destination: "campus" },
  ];
}
