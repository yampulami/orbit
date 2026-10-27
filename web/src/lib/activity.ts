/** How alive a club is, from what it has actually done: events held or coming up, and its latest post. Not from popularity or message volume,
 *  so a quiet club that really meets is not buried under a noisy one that does not. */
export type Activity = { level: "active" | "steady" | "quiet" | "new"; label: string; eventsThisMonth: number; upcoming: number; lastPostDays: number | null; line: string };

const DAY = 86400000;
type Ev = { startsAt: string; endsAt?: string; status: string; canceled: boolean };

export function activityOf(events: Ev[], lastPost: string | undefined, now: Date, createdAt?: string): Activity {
  const live = events.filter((e) => e.status === "published" && !e.canceled);
  const t = now.getTime();
  const end = (e: Ev) => new Date(e.endsAt ?? new Date(e.startsAt).getTime() + 3 * 3600_000).getTime();
  const upcoming = live.filter((e) => end(e) >= t).length;
  const eventsThisMonth = live.filter((e) => { const s = new Date(e.startsAt).getTime(); return s >= t - 30 * DAY && s <= t + 30 * DAY; }).length;
  const lastPostDays = lastPost ? Math.max(0, Math.floor((t - new Date(lastPost).getTime()) / DAY)) : null;
  const recentEvent = live.some((e) => { const s = new Date(e.startsAt).getTime(); return s >= t - 60 * DAY; });
  const brandNew = !!createdAt && t - new Date(createdAt).getTime() < 14 * DAY;

  let level: Activity["level"];
  if (upcoming > 0 || eventsThisMonth >= 1 || (lastPostDays !== null && lastPostDays <= 7)) level = "active";
  else if (recentEvent || (lastPostDays !== null && lastPostDays <= 30)) level = "steady";
  else if (brandNew) level = "new";
  else level = "quiet";

  const parts: string[] = [];
  if (eventsThisMonth > 0) parts.push(`${eventsThisMonth} ${eventsThisMonth === 1 ? "event" : "events"} this month`);
  if (lastPostDays !== null) parts.push(lastPostDays === 0 ? "posted today" : `last post ${lastPostDays} ${lastPostDays === 1 ? "day" : "days"} ago`);
  const label = level === "active" ? "Active" : level === "steady" ? "Steady" : level === "new" ? "New" : "Quiet";
  return { level, label, eventsThisMonth, upcoming, lastPostDays, line: parts.join(" · ") };
}
