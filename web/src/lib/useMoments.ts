import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth";
import { useHang } from "./hangouts";
import { useCampusEvents } from "./campusEvents";
import { loadFriendFree, loadGroupPeople, whenForgotten } from "./availability";
import { useMyBusy } from "./useMyBusy";
import { useMomentPrefs } from "./momentPrefs";
import { detectMoments, type Circle, type Moment } from "./moments";
import type { Person } from "./freeTime";

/** Who in each of your groups shares their free time with you. One lookup shared by everything on screen, remembered for a few minutes: it is a small amount of data that changes slowly. */
const cache = new Map<string, { at: number; circle: Promise<Circle> }>();
const FRESH = 5 * 60_000;

function loadCircle(g: { id: string; name: string }, me: string): Promise<Circle> {
  const hit = cache.get(g.id);
  if (hit && Date.now() - hit.at < FRESH) return hit.circle;
  const circle = (async (): Promise<Circle> => {
    const people = await loadGroupPeople(g.id, me);
    const { sharing, notSharing } = await loadFriendFree(people);
    return { id: g.id, name: g.name, members: sharing as Person[], unknown: notSharing, total: people.length + 1 };
  })();
  cache.set(g.id, { at: Date.now(), circle });
  circle.catch(() => cache.delete(g.id));
  return circle;
}
/** Forget the circles (sharing or the groups changed). */
export const forgetCircles = () => cache.clear();
whenForgotten(forgetCircles);

/** The suggestions for right now: nothing is looked up unless the student turned Moments on. */
export function useMoments(limit = 5): { moments: Moment[]; loading: boolean; enabled: boolean; circles: Circle[] } {
  const { session } = useAuth();
  const uid = session?.user.id;
  const prefs = useMomentPrefs();
  const { groups } = useHang();
  const { events } = useCampusEvents();
  const [now, setNow] = useState(() => new Date());
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(t); }, []);
  const { me } = useMyBusy(now);

  const key = groups.map((g) => g.id).join(",");
  useEffect(() => {
    let live = true;
    if (!prefs.enabled || !uid || groups.length === 0) { setCircles([]); return; }
    setLoading(true);
    void Promise.all(groups.slice(0, 8).map((g) => loadCircle(g, uid).catch(() => null))).then((all) => {
      if (live) { setCircles(all.filter((c): c is Circle => !!c)); setLoading(false); }
    });
    return () => { live = false; };
  }, [key, prefs.enabled, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const minute = Math.floor(now.getTime() / 60000);
  const moments = useMemo(
    () => detectMoments({
      now, me, circles, prefs, max: limit,
      events: events.map((e) => ({ id: e.id, title: e.title, description: e.description, place: e.place, startsAt: e.startsAt, endsAt: e.endsAt, status: e.status, canceled: e.canceled, verified: e.kind === "official" || !!e.orgId })),
    }),
    [minute, me, circles, prefs, events, limit], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return { moments, loading, enabled: prefs.enabled, circles };
}
