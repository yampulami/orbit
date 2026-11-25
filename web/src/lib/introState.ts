import type { Req } from "./alumni";

/** A no is respected for this long (the server holds to it too). */
export const WAIT_AFTER_NO = 90;

/** Where things stand between you and one graduate, from the requests you sent them. */
export function introState(reqs: Req[], id: string, now = Date.now()): "none" | "pending" | "accepted" | "wait" {
  const mine = reqs.filter((r) => !r.incoming && r.otherId === id);
  if (mine.some((r) => r.status === "accepted")) return "accepted";
  if (mine.some((r) => r.status === "pending")) return "pending";
  const days = (iso: string) => (now - new Date(iso).getTime()) / 86400_000;
  return mine.some((r) => r.status === "declined" && days(r.decidedAt ?? r.at) < WAIT_AFTER_NO) ? "wait" : "none";
}
