import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { isOpen, useCampusEvents } from "../lib/campusEvents";
import { useCampusOrgs } from "../lib/campusOrgs";
import { useClasses } from "../lib/classes";
import { useReminders } from "../lib/reminders";
import { unreadDms, useDms } from "../lib/dms";
import { useNotifs } from "../lib/notifs";
import { answerFor, type AssistantCtx } from "../lib/assistant";
import MorphOrb from "./MorphOrb";
import Orb from "./Orb";

/** The floating Orbit assistant. A small orb waits in the corner of every page; tap it and the assistant opens over the page. It answers from what Orbit knows
 *  (events, clubs, your classes, reminders, unread counts) and can open a page for you. Nothing you ask leaves the app. */
export default function Assistant() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { events } = useCampusEvents();
  const { orgs } = useCampusOrgs();
  const classes = useClasses();
  const reminders = useReminders();
  const dms = useDms();
  const notifs = useNotifs();

  // The answer is made from the newest of everything at the moment you ask.
  const ctx = useRef<AssistantCtx>({ now: new Date(), events: [], clubs: [], classes: [], reminders: [], unreadMessages: 0, unreadNotifs: 0 });
  const now = new Date();
  ctx.current = {
    now,
    events: events.filter((e) => e.status === "published" && !e.canceled && isOpen(e, now)).map((e) => ({ title: e.title, description: e.description, startsAt: e.startsAt, endsAt: e.endsAt, place: e.place, host: e.host, going: e.going })),
    clubs: orgs.filter((o) => o.status === "active").map((o) => ({ id: o.id, name: o.name, kind: o.kind, description: o.description, people: o.memberCount + o.members.length, mine: o.mine || o.myJoin === "member", category: o.application.category, meeting: o.application.meeting })),
    classes,
    reminders: (reminders as { title: string; date: string; time?: string; done: boolean }[]),
    unreadMessages: unreadDms(dms.threads),
    unreadNotifs: notifs.filter((n) => n.unread).length,
  };

  // Close with Escape (when the pill is waiting), and stop the page scrolling behind it.
  useEffect(() => {
    if (!open) return;
    const lock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && document.querySelector('.mo-root[data-phase="idle"]')) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = lock; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const ask = (q: string) => {
    const r = answerFor(q, ctx.current);
    if (r.go) nav(r.go);
    return r.text;
  };

  return (
    <>
      <button type="button" className="asst-fab" aria-label="Ask Orbit" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Orb size={50} variant="violet" poke={false} />
        <span className="asst-tip" aria-hidden="true">Ask Orbit</span>
      </button>
      {open && createPortal(
        <div className="asst-layer" role="dialog" aria-modal="true" aria-label="Orbit assistant" onMouseDown={(e) => { if ((e.target as HTMLElement).classList.contains("mo-bg") && document.querySelector('.mo-root[data-phase="idle"]')) setOpen(false); }}>
          <MorphOrb onSubmit={ask} />
          <button type="button" className="asst-x" aria-label="Close the assistant" onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button>
        </div>,
        document.body,
      )}
    </>
  );
}
