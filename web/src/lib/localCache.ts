/** The last thing each screen showed, kept on this device so the next visit paints at once and then catches up with the database.
 *  It is kept per person and wiped when they sign out. */
const PREFIX = "orbit-cache:";
const MAX_CHARS = 500_000; // a very large screen is simply not kept; it loads the usual way
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function readCache<T>(name: string, userId: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    if (!raw) return null;
    const c = JSON.parse(raw) as { u?: string; v?: T };
    return c.u === userId && c.v !== undefined ? c.v : null;
  } catch { return null; }
}

/** Saved a moment after the last change, so a burst of changes is one write. */
export function writeCache(name: string, userId: string, value: unknown) {
  clearTimeout(timers.get(name));
  timers.set(name, setTimeout(() => {
    timers.delete(name);
    try {
      const raw = JSON.stringify({ u: userId, v: value });
      if (raw.length <= MAX_CHARS) localStorage.setItem(PREFIX + name, raw); else localStorage.removeItem(PREFIX + name);
    } catch { /* storage full or unavailable: it just loads the usual way */ }
  }, 400));
}

/** Forget everything kept for anyone (sign out, delete account). */
export function clearCaches() {
  timers.forEach((t) => clearTimeout(t)); timers.clear();
  try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
}
