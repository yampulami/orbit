import { useCallback, useEffect, useState } from "react";

/** A pause before the same email can be asked for again, so pressing the button over and over cannot send a stack of emails. It survives a page reload
 *  (kept for the tab's session), so refreshing does not skip the wait. */
export const EMAIL_COOLDOWN_SECONDS = 60;

const KEY = (name: string) => `orbit-cooldown:${name.toLowerCase()}`;

/** Pure: whole seconds left until `until` (0 when it has passed). */
export const secondsLeft = (until: number, now: number) => Math.max(0, Math.ceil((until - now) / 1000));

const readUntil = (name: string): number => { try { return Number(sessionStorage.getItem(KEY(name)) ?? 0) || 0; } catch { return 0; } };

/** A countdown for one named action (include the email in the name, so a different address is not held up). `start()` begins the wait. */
export function useCooldown(name: string) {
  const [until, setUntil] = useState(() => readUntil(name));
  const [now, setNow] = useState(() => Date.now());

  // A different name means a different wait.
  useEffect(() => { setUntil(readUntil(name)); setNow(Date.now()); }, [name]);
  // Tick once a second, only while there is something to count.
  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => { const n = Date.now(); setNow(n); if (n >= until) clearInterval(t); }, 1000);
    return () => clearInterval(t);
  }, [until]);

  const start = useCallback((seconds = EMAIL_COOLDOWN_SECONDS) => {
    const u = Date.now() + seconds * 1000;
    try { sessionStorage.setItem(KEY(name), String(u)); } catch { /* the wait still holds on this screen */ }
    setUntil(u); setNow(Date.now());
  }, [name]);

  return { left: secondsLeft(until, now), start };
}
