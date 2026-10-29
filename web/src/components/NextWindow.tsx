import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock, Users } from "lucide-react";
import { useMyBusy } from "../lib/useMyBusy";
import { useFriends } from "../lib/friends";
import { useHang } from "../lib/hangouts";
import { useCampusEvents } from "../lib/campusEvents";
import { loadFriendFree } from "../lib/availability";
import { freeNow, span, type Person } from "../lib/freeTime";

/** "You have 50 minutes free": what is on in that gap, and which friends are free too (only those who chose to share). Shows nothing when there is no real gap. */
export default function NextWindow() {
  const { friends } = useFriends();
  const { hangouts } = useHang();
  const { events } = useCampusEvents();
  const [now, setNow] = useState(() => new Date());
  const [shared, setShared] = useState<Person[]>([]);
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(t); }, []);

  const key = friends.map((f) => f.id).join(",");
  useEffect(() => {
    let live = true;
    if (friends.length === 0) { setShared([]); return; }
    void loadFriendFree(friends).then((r) => { if (live) setShared(r.sharing); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const { me } = useMyBusy(now);
  const free = freeNow(me, now);
  if (!free || free.minutes < 25) return null;

  const until = free.until.getTime();
  const happening = [
    ...events.filter((e) => e.status === "published" && !e.canceled && new Date(e.startsAt).getTime() >= now.getTime() - 15 * 60000 && new Date(e.startsAt).getTime() < until)
      .map((e) => ({ key: "e" + e.id, title: e.title, at: new Date(e.startsAt), place: e.place, to: "/app/campus", icon: "event" as const })),
    ...hangouts.filter((h) => !h.canceled && new Date(h.when).getTime() >= now.getTime() && new Date(h.when).getTime() < until)
      .map((h) => ({ key: "h" + h.id, title: h.title, at: new Date(h.when), place: h.place, to: "/app/groups", icon: "hang" as const })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 3);
  const alsoFree = shared.filter((p) => (freeNow(p, now)?.minutes ?? 0) >= 25);
  const t = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <section className="nextwin" aria-label="Your next free window">
      <div className="nw-head">
        <span className="nw-ic" aria-hidden="true"><Clock size={18} /></span>
        <div>
          {free.minutes >= 180
            ? <><strong>You are free until {t(free.until)}</strong><small>Nothing is planned until then</small></>
            : <><strong>You have {span(free.minutes)} free</strong><small>until {t(free.until)}</small></>}
        </div>
        {alsoFree.length > 0
          ? <Link to="/app/sync" state={{ syncWith: alsoFree.map((p) => p.id) }} className="link-btn nw-find">Plan with {alsoFree[0].name.split(" ")[0]}{alsoFree.length > 1 ? ` +${alsoFree.length - 1}` : ""}</Link>
          : <Link to="/app/sync" className="link-btn nw-find">Find a time</Link>}
      </div>
      {alsoFree.length > 0 && (
        <p className="nw-friends"><Users size={14} aria-hidden="true" /> {alsoFree.slice(0, 3).map((p) => p.name.split(" ")[0]).join(", ")}{alsoFree.length > 3 ? ` and ${alsoFree.length - 3} more` : ""} {alsoFree.length === 1 ? "is" : "are"} free too</p>
      )}
      {happening.length > 0 && (
        <ul className="nw-list">
          {happening.map((x) => (
            <li key={x.key}>
              <Link to={x.to}>
                <CalendarDays size={14} aria-hidden="true" />
                <span><b>{x.title}</b> · {t(x.at)}{x.place ? ` · ${x.place}` : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
