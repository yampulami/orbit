/** A limit on how often something can be tried from this browser: at most `max` tries in any `windowMs`, kept across reloads (sessionStorage).
 *  This is the polite first line (a clear "wait 40 s" instead of a wall of errors); it can be bypassed by clearing storage, so the real limits are on the
 *  server (the sign-in function and the database triggers, see supabase/migrations/*_rate_limits.sql, and Supabase Auth's own limits). */

const KEY = (name: string) => `orbit-attempts:${name.toLowerCase()}`;

/** Pure: the tries still inside the window. */
export const recent = (times: number[], now: number, windowMs: number) => times.filter((t) => now - t < windowMs);

/** Pure: whole seconds until another try is allowed (0 when one is allowed now). */
export function waitSeconds(times: number[], now: number, max: number, windowMs: number): number {
  const live = recent(times, now, windowMs);
  if (live.length < max) return 0;
  return Math.max(1, Math.ceil((live[live.length - max] + windowMs - now) / 1000));
}

const read = (name: string): number[] => {
  try { const v = JSON.parse(sessionStorage.getItem(KEY(name)) ?? "[]"); return Array.isArray(v) ? v.filter((n) => typeof n === "number") : []; } catch { return []; }
};
const write = (name: string, v: number[]) => { try { sessionStorage.setItem(KEY(name), JSON.stringify(v)); } catch { /* the limit still holds for this page's lifetime via the caller */ } };

/** Seconds to wait before this action may be tried again (0 = go ahead). Does not count a try. */
export function limitLeft(name: string, max: number, windowMs: number): number {
  return waitSeconds(read(name), Date.now(), max, windowMs);
}

/** Count one try. */
export function countAttempt(name: string, windowMs: number) {
  const now = Date.now();
  write(name, [...recent(read(name), now, windowMs), now]);
}

/** Forget the tries (after a success). */
export function clearAttempts(name: string) { try { sessionStorage.removeItem(KEY(name)); } catch { /* nothing to clear */ } }

export const waitMessage = (s: number) => `Too many tries. Please wait ${s >= 60 ? Math.ceil(s / 60) + " min" : s + " s"} and try again.`;
