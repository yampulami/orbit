import { supabase } from "./supabase";
import { YOU } from "./hangTypes";

/** Shared helpers for showing people from the database the way the screens expect: by display name, with "You" for the signed-in student. */

/** A function that names a user. Two different people with the same display name get a short suffix so they stay apart. */
export function makeLabeler(me: string, ids: Iterable<string>, names: Record<string, string>, fallback: (id: string) => string | undefined = () => undefined) {
  const base = (id: string) => (names[id] ?? fallback(id) ?? "Student").trim() || "Student";
  const count = new Map<string, number>();
  for (const id of new Set(ids)) if (id !== me) count.set(base(id), (count.get(base(id)) ?? 0) + 1);
  return (id: string) => (id === me ? YOU : (count.get(base(id)) ?? 0) > 1 ? `${base(id)} ${id.slice(0, 4)}` : base(id));
}

/** Display names for some user ids, from the student profiles on the same campus. */
export async function loadNames(userIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return {};
  const out: Record<string, string> = {};
  const now = Date.now();
  const missing: string[] = [];
  for (const id of ids) {
    const hit = nameCache.get(id);
    if (hit && now - hit.at < NAME_TTL_MS) out[id] = hit.name; else missing.push(id);
  }
  if (!missing.length) return out; // names rarely change, and every live update asks again: skip the trip when all are known
  const { data, error } = await supabase!.from("student_profiles").select("user_id,display_name").in("user_id", missing);
  if (error) throw new Error(error.message);
  ((data ?? []) as { user_id: string; display_name: string }[]).forEach((p) => { out[p.user_id] = p.display_name; nameCache.set(p.user_id, { name: p.display_name, at: now }); });
  return out;
}
const NAME_TTL_MS = 30000;
const nameCache = new Map<string, { name: string; at: number }>();
/** Forget remembered names (after blocking, signing out, or a name change). */
export const forgetNames = () => nameCache.clear();
if (typeof window !== "undefined") window.addEventListener("orbit-refresh", forgetNames);

/** Ask every screen to look again now, for example after blocking someone, so what they made disappears without a reload. */
export const refreshEverything = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("orbit-refresh")); };

/** How often to look again when the live connection is down, and as a safety net when it seems fine. */
export const POLL_DOWN_MS = 15000;
export const POLL_SAFETY_MS = 120000;
/** If the connection has not come up by now, treat it as down (for example a network that blocks live connections). */
export const CONNECT_GRACE_MS = 8000;
/** After a look, changes arriving within this long are folded into one more look. */
export const COALESCE_MS = 120;
/** How often a screen that must feel instant (chat) quietly asks "is there anything newer than what I show?" while the page is on screen. It covers a phone
 *  whose live connection went to sleep without telling anyone. */
export const PROBE_MS = 4000;

/** For a probe: say "out of date" for the same newest thing at most a few times, so something that can never be shown (it is hidden from this
 *  person, say) cannot make a screen reload every few seconds forever. */
export function staleLimiter(max = 3) {
  let last = "", tries = 0;
  return (id: string, stale: boolean) => {
    if (!stale) return false;
    if (id !== last) { last = id; tries = 0; }
    return ++tries <= max;
  };
}

/** When a phone wakes up or the tab comes back after a while, the live connection may be asleep: make sure it is open again and have every screen
 *  look again. A quick flick away and back does not count. */
let hiddenAt = 0;
function wake() {
  try { if (supabase && !supabase.realtime.isConnected()) supabase.realtime.connect(); } catch { /* the slower checks still run */ }
  refreshEverything();
}
if (typeof window !== "undefined" && supabase) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 3000) wake();
    hiddenAt = 0;
  });
  window.addEventListener("pageshow", (e) => { if ((e as PageTransitionEvent).persisted) wake(); }); // restored from the back/forward cache
}

/** One change from the database, with the row as it is now (and, for a delete, the id of the row that went). */
export type ChangeEvent = { table: string; type: "INSERT" | "UPDATE" | "DELETE"; row: Record<string, unknown>; old: Record<string, unknown> };

/** Call `onChange` whenever any of these tables change (shortly after, and once for a burst). Returns a function that stops listening.
 *
 *  It is built so a screen never gets stuck showing old things:
 *  - if the live connection drops and comes back, it looks again at once, to catch up on what was missed;
 *  - if the connection is down, or never comes up (some school networks block live connections), it looks again every 15 seconds;
 *  - even when everything seems fine it looks again every two minutes, in case a change was missed;
 *  - it looks again the moment the device comes back online. It only does any of this while the page is on screen. */
export function watchTables(name: string, tables: string[], onChange: () => void, onEvent?: (e: ChangeEvent) => boolean, probe?: () => Promise<boolean>): () => void {
  const sb = supabase!;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false, healthy = false, everUp = false;
  // The first change looks at once; changes that follow within a moment are folded into one more look right after.
  let cooling = false, again = false;
  const soon = () => {
    if (stopped) return;
    if (cooling) { again = true; return; }
    cooling = true; again = false;
    onChange();
    timer = setTimeout(() => {
      cooling = false;
      if (again && !stopped) { again = false; soon(); }
    }, COALESCE_MS);
  };
  const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

  const ch = sb.channel(`${name}-${Math.random().toString(36).slice(2, 8)}`);
  // A change that arrives with its row can be applied straight away (return true) instead of fetching everything again.
  const arrived = (p?: { table?: string; eventType?: ChangeEvent["type"]; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
    if (onEvent && p?.table && p.eventType) {
      let handled = false;
      try { handled = onEvent({ table: p.table, type: p.eventType, row: p.new ?? {}, old: p.old ?? {} }); } catch { handled = false; }
      if (handled) return;
    }
    soon();
  };
  for (const table of tables) ch.on("postgres_changes", { event: "*", schema: "public", table }, arrived);
  ch.subscribe((status) => {
    if (stopped) return;
    if (status === "SUBSCRIBED") {
      const catchUp = everUp && !healthy; // it was down and is back: what happened meanwhile was missed
      healthy = true; everUp = true;
      if (catchUp) soon();
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      healthy = false;
    }
  });

  // One timer does both jobs: quick looks while the connection is down, slow ones as a safety net while it is up.
  let sinceLook = 0;
  const tick = setInterval(() => {
    if (!visible()) return;
    sinceLook += POLL_DOWN_MS;
    if (!healthy || sinceLook >= POLL_SAFETY_MS) { sinceLook = 0; onChange(); }
  }, POLL_DOWN_MS);
  // A cheap question every few seconds: "is what I show out of date?". Much lighter than looking at everything again, and only a "yes" does that.
  let probing = false;
  const askProbe = async () => {
    if (!probe || probing || stopped || !visible()) return;
    probing = true;
    try { if (await probe()) soon(); } catch { /* try again next time */ } finally { probing = false; }
  };
  const probeTick = probe ? setInterval(() => void askProbe(), PROBE_MS) : undefined;
  const grace = setTimeout(() => { if (!everUp && !stopped) onChange(); }, CONNECT_GRACE_MS); // never connected at all
  const online = () => soon();
  if (typeof window !== "undefined") { window.addEventListener("online", online); window.addEventListener("orbit-refresh", online); }

  return () => {
    stopped = true;
    clearTimeout(timer); clearTimeout(grace); clearInterval(tick); if (probeTick) clearInterval(probeTick);
    if (typeof window !== "undefined") { window.removeEventListener("online", online); window.removeEventListener("orbit-refresh", online); }
    void sb.removeChannel(ch);
  };
}
