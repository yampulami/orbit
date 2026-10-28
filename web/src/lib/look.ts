/** Small, pure helpers that give clubs and events their own look: a colour from the name, a "workshop / talk / game night" hint from the words, and plain-language timing. */

/** A hue between violet and magenta, the same for the same name everywhere (so a club keeps its colour). */
export function hueFor(name: string): number {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 245 + (h % 85);
}

export type FlavorKey = "workshop" | "talk" | "social" | "game" | "meeting" | "fair" | "sport" | "food";
const FLAVORS: [FlavorKey, string, RegExp][] = [
  ["workshop", "Workshop", /\b(workshop|build|hack|hackathon|lab|class|lesson|training|tutorial|bootcamp)\b/i],
  ["talk", "Talk", /\b(talk|lecture|panel|speaker|seminar|q&a|keynote|info session)\b/i],
  ["game", "Game night", /\b(game|chess|tournament|trivia|esports|board game|quiz|arcade)\b/i],
  ["sport", "Sports", /\b(run|match|scrimmage|practice|fitness|yoga|hike|soccer|basketball|volleyball|swim)\b/i],
  ["food", "Food", /\b(bake|potluck|dinner|lunch|snacks|pizza|coffee|brunch|cook)\b/i],
  ["fair", "Fair", /\b(fair|expo|showcase|fest|festival|market)\b/i],
  ["meeting", "Meeting", /\b(meeting|general body|gbm|committee|election|orientation)\b/i],
  ["social", "Social", /\b(social|party|mixer|movie|screening|night|meetup|hangout|picnic|karaoke)\b/i],
];

/** A guess at what kind of event this is from its title (then its description), or null. This is a visual hint only; nothing is stored. */
export function eventFlavor(title: string, description = ""): { key: FlavorKey; label: string } | null {
  for (const text of [title, description]) {
    for (const [key, label, re] of FLAVORS) if (re.test(text)) return { key, label };
  }
  return null;
}

export type Countdown = { text: string; tone: "live" | "soon" | "later" | "past" };
const HOUR = 3600000;

/** How close an event is, in plain words. */
export function countdown(startsAt: string, endsAt: string | undefined, now: Date): Countdown {
  const s = new Date(startsAt).getTime();
  const e = endsAt ? new Date(endsAt).getTime() : s + 3 * HOUR;
  const t = now.getTime();
  if (t > e) return { text: "Over", tone: "past" };
  if (t >= s) return { text: "Happening now", tone: "live" };
  const mins = Math.round((s - t) / 60000);
  if (mins < 60) return { text: mins <= 1 ? "Starts in a minute" : `Starts in ${mins} min`, tone: "soon" };
  const hours = Math.round(mins / 60);
  if (hours < 24 && new Date(s).toDateString() === now.toDateString()) return { text: `In ${hours} h`, tone: "soon" };
  const days = Math.round((new Date(new Date(s).toDateString()).getTime() - new Date(now.toDateString()).getTime()) / (24 * HOUR));
  if (days <= 1) return { text: "Tomorrow", tone: "soon" };
  if (days <= 6) return { text: `In ${days} days`, tone: "later" };
  return { text: `In ${Math.round(days / 7)} wk`, tone: "later" };
}

/** A heading for a day in a list: Today, Tomorrow, or the date. */
export function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / (24 * HOUR));
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

/** A round avatar's colours, taken from the name: two hues that go well together, the same every time for the same person. */
export function gradientFor(name: string): string {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = h % 360;
  return `linear-gradient(135deg, hsl(${a} 78% 68%), hsl(${(a + 70) % 360} 70% 52%))`;
}
