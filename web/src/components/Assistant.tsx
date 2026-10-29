import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { eventActions, isOpen, useCampusEvents } from "../lib/campusEvents";
import { canHostEvents, eventsNeedApproval, orgActions, useCampusOrgs } from "../lib/campusOrgs";
import { hangActions, useHang } from "../lib/hangouts";
import { useFriends } from "../lib/friends";
import { searchPeople } from "../lib/peopleSearch";
import { dmActions } from "../lib/dms";
import { converse, performAction, type AiEnv, type AiTurn, type ModelMsg, type Pending } from "../lib/assistantAi";
import { AiProblem, askModel } from "../lib/assistantModel";
import { useClasses } from "../lib/classes";
import { reminderActions, useReminders } from "../lib/reminders";
import { classActions } from "../lib/classes";
import { loadFriendFree } from "../lib/availability";
import { commonFree, myBusy } from "../lib/freeTime";
import { feedApi } from "../lib/feedData";
import { unreadDms, useDms } from "../lib/dms";
import { useNotifs } from "../lib/notifs";
import { useAuth } from "../lib/auth";
import { answerFor, type AssistantCtx, type Reply } from "../lib/assistant";
import { makeMsg, useChatHistory, type Msg } from "../lib/assistantChats";
import AssistantChat from "./AssistantChat";
import MorphOrb from "./MorphOrb";
import Orb from "./Orb";

/** Where the launcher sits, as a share of the room it can move in, so it stays put when the window changes size. */
type Frac = { fx: number; fy: number };
const POS_KEY = "orbit-assistant-pos";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const isPhone = () => window.innerWidth <= 900;
const size = () => (isPhone() ? 54 : 62);
/** The room the launcher can move in: clear of the edges, and above the tab bar on a phone. */
const room = () => {
  const s = size(), m = isPhone() ? 12 : 16;
  return { minX: m, maxX: Math.max(m, window.innerWidth - s - m), minY: m, maxY: Math.max(m, window.innerHeight - s - (isPhone() ? 88 : m)) };
};
const toPx = (f: Frac) => { const r = room(); return { x: r.minX + f.fx * (r.maxX - r.minX), y: r.minY + f.fy * (r.maxY - r.minY) }; };
const toFrac = (x: number, y: number): Frac => { const r = room(); return { fx: r.maxX === r.minX ? 0 : (x - r.minX) / (r.maxX - r.minX), fy: r.maxY === r.minY ? 0 : (y - r.minY) / (r.maxY - r.minY) }; };
function readPos(): Frac | null {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || "null");
    return p && typeof p.fx === "number" && typeof p.fy === "number" ? { fx: clamp(p.fx, 0, 1), fy: clamp(p.fy, 0, 1) } : null;
  } catch { return null; }
}

type Mode = "closed" | "morph" | "chat";

/** The floating Orbit assistant. A small orb waits in the corner of every page and can be dragged anywhere. Tap it and the assistant grows out of the orb:
 *  the first question plays out as the morphing pill, then the conversation opens as a chat with history and a New chat button. It answers from what Orbit knows
 *  (events, clubs, your classes, reminders, unread counts) and can open a page for you. Nothing you ask leaves the app. */
export default function Assistant() {
  const [mode, setMode] = useState<Mode>("closed");
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const calm = useReducedMotion();
  const nav = useNavigate();
  const { session } = useAuth();
  const { events } = useCampusEvents();
  const { orgs } = useCampusOrgs();
  const classes = useClasses();
  const reminders = useReminders();
  const dms = useDms();
  const notifs = useNotifs();
  const history = useChatHistory(session?.user.id ?? "guest");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const timers = useRef<number[]>([]);
  const lastReply = useRef<(Reply & { pending?: Pending }) | null>(null);
  const { groups, hangouts } = useHang();
  const { friends } = useFriends();
  const [step, setStep] = useState("");

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

  /* ── the launcher: drag it anywhere, tap it to open ── */
  const fab = useRef<HTMLButtonElement>(null);
  const [frac, setFrac] = useState<Frac | null>(() => (typeof window === "undefined" ? null : readPos()));
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);
  const [settling, setSettling] = useState(false);
  const [, bump] = useState(0);
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  useEffect(() => {
    const on = () => bump((n) => n + 1);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const spot = live ?? (frac ? toPx(frac) : null);
  const side = spot ? (spot.x + size() / 2 < window.innerWidth / 2 ? "right" : "left") : isPhone() ? "right" : "left";

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !fab.current) return;
    const r = fab.current.getBoundingClientRect();
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
    fab.current.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    if (!d.moved) { d.moved = true; setSettling(false); }
    const r = room();
    setLive({ x: clamp(d.ox + dx, r.minX, r.maxX), y: clamp(d.oy + dy, r.minY, r.maxY) });
  };
  const onUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    // Let go and it settles against the nearer side of the screen.
    const r = room();
    const at = live ?? { x: d.ox, y: d.oy };
    const x = at.x + size() / 2 < window.innerWidth / 2 ? r.minX : r.maxX;
    const next = toFrac(x, at.y);
    setSettling(true);
    setFrac(next);
    setLive(null);
    try { localStorage.setItem(POS_KEY, JSON.stringify(next)); } catch { /* it just will not be remembered */ }
    justDragged.current = true;
    window.setTimeout(() => { justDragged.current = false; }, 80);
  };

  const openFrom = () => {
    if (justDragged.current) return;
    const r = fab.current?.getBoundingClientRect();
    setOrigin(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth - 56, y: window.innerHeight - 56 });
    // Someone who has chatted before goes straight to their chats; the pill is for the very first question.
    setMode(history.chats.some((c) => c.messages.length > 0) ? "chat" : "morph");
  };

  const close = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setThinking(false);
    setFreshId(null);
    setMode("closed");
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Stop the page scrolling behind it; Escape closes the pill while it is waiting (the chat handles its own).
  useEffect(() => {
    if (mode === "closed") return;
    const lock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (mode === "morph" && e.key === "Escape" && document.querySelector('.mo-root[data-phase="idle"]')) close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = lock; window.removeEventListener("keydown", onKey); };
  }, [mode, close]);

  /* ── the first question, in the morphing pill ── */
  /** The assistant's own answer: the AI when it is switched on (with Orbit's data as tools), otherwise the built-in rules. */
  const think = async (history: Msg[], q: string): Promise<AiTurn> => {
    const nowD = new Date();
    const env = aiEnv();
    const past: ModelMsg[] = history.slice(-10).map((m) => ({ role: m.role, content: m.text }));
    try {
      const turn = await converse({
        history: [...past, { role: "user", content: q }],
        env,
        onStep: setStep,
        model: (messages) => askModel(messages, { name: session?.user.user_metadata?.name ?? session?.user.email?.split("@")[0] ?? "Student", now: nowD.toString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (turn.text) return turn;
      const r = answerFor(q, ctx.current);
      return { text: r.text, go: r.go, goLabel: r.goLabel };
    } catch (e) {
      if (!(e instanceof AiProblem)) console.warn("The assistant hit a problem:", e);
      const r = answerFor(q, ctx.current);
      const why = e instanceof AiProblem && e.code !== "off" ? `${e.message} Here is what Orbit can tell you directly. ` : "";
      return { text: why + r.text, go: r.go, goLabel: r.goLabel };
    } finally { setStep(""); }
  };
  const ask = async (q: string) => {
    const t = await think([], q);
    lastReply.current = t;
    return t.text;
  };
  // Once the answer has settled, give it a moment to be read, then open the conversation around it.
  const answered = (q: string, a: string) => {
    if (!q) return;
    const r = lastReply.current;
    const t = window.setTimeout(() => {
      if (!document.querySelector('.mo-root[data-phase="answered"]')) return; // they went back to the pill
      const id = history.startWith(q, a, { ...(r?.go ? { go: r.go, goLabel: r.goLabel } : {}), ...(r?.pending ? { pending: r.pending } : {}) });
      setActiveId(id);
      setMode("chat");
    }, calm ? 600 : 1500);
    timers.current.push(t);
  };

  /* ── the conversation ── */
  const send = (text: string) => {
    let id = activeId;
    if (!id || !history.chats.some((c) => c.id === id)) { id = history.start(); setActiveId(id); }
    history.add(id, makeMsg("user", text));
    setThinking(true);
    const chatId = id;
    const before = history.chats.find((c) => c.id === chatId)?.messages ?? [];
    void think(before, text).then((r) => {
      const m = makeMsg("assistant", r.text, { ...(r.go ? { go: r.go, goLabel: r.goLabel } : {}), ...(r.pending ? { pending: r.pending } : {}) });
      history.add(chatId, m);
      setFreshId(m.id);
      setThinking(false);
    });
  };
  /** The student answers a confirm card: do the change, or leave it. */
  const decide = async (msgId: string, yes: boolean) => {
    const chat = history.chats.find((c) => c.id === activeId);
    const msg = chat?.messages.find((m) => m.id === msgId);
    if (!chat || !msg?.pending || msg.pending.state !== "pending") return;
    if (!yes) { history.patch(chat.id, msgId, { pending: { ...msg.pending, state: "cancelled" } }); return; }
    const out = await performAction(aiEnv(), msg.pending);
    history.patch(chat.id, msgId, { pending: { ...msg.pending, state: out.ok ? "done" : "failed", note: out.note } });
    if (out.go) history.patch(chat.id, msgId, { go: out.go, goLabel: out.goLabel });
  };
  /** Everything the AI may look at, and the changes it may ask to make (each one is confirmed first). */
  function aiEnv(): AiEnv {
    const nowD = new Date();
    const me = session?.user.id ?? "";
    return {
      now: nowD,
      events: events.filter((e) => e.status === "published" && !e.canceled && isOpen(e, nowD)).map((e) => ({ id: e.id, title: e.title, description: e.description, startsAt: e.startsAt, endsAt: e.endsAt, place: e.place, host: e.host, going: e.going, mine: e.mine, orgId: e.orgId })),
      clubs: orgs.filter((o) => o.status === "active").map((o) => ({ id: o.id, name: o.name, kind: o.kind, description: o.description, people: o.memberCount + o.members.length, mine: o.mine || o.myJoin === "member", category: o.application.category, meeting: o.application.meeting, canPost: o.mine && canHostEvents(o) && o.myPerms.includes("events"), orgKind: o.kind, trusted: !eventsNeedApproval(o) })),
      classes,
      reminders: reminders as { id: string; title: string; date: string; time?: string; done: boolean }[],
      notifications: notifs.map((n) => ({ title: n.title, sub: n.sub, at: n.at, unread: n.unread })),
      profile: { name: session?.user.user_metadata?.name ?? session?.user.email?.split("@")[0] ?? "Student" },
      recentPosts: async () => (await feedApi.list()).filter((r) => !r.payload.repostOf).map((r) => ({ author: r.author_name, text: r.payload.body ?? r.payload.text ?? r.payload.title ?? "", at: r.created_at, likes: r.post_likes.length, comments: r.post_comments.length })),
      findFreeTime: async (names, days) => {
        const wanted = names.map((n) => friends.find((f) => f.name.toLowerCase() === n.toLowerCase() || (f.username ?? "").toLowerCase() === n.toLowerCase().replace(/^@/, "")) ?? friends.find((f) => f.name.toLowerCase().includes(n.toLowerCase())));
        const unknown = names.filter((_, i) => !wanted[i]);
        const chosen = wanted.filter((f): f is NonNullable<typeof f> => !!f);
        const { sharing: shared, notSharing } = await loadFriendFree(chosen);
        const mine = myBusy(classes, hangouts, events.filter((e) => e.mine === "going" && isOpen(e, nowD)));
        const windows = commonFree([mine, ...shared], nowD, { days, min: 60 }).map((w) => ({ start: w.start.toISOString(), minutes: w.minutes }));
        return { windows, notSharing, unknown };
      },
      rsvpEvent: (id, answer) => eventActions.respond(id, answer),
      requestJoin: (orgId, message) => orgActions.requestJoin(orgId, message),
      addClass: (c) => classActions.add(c),
      setReminderDone: (id, done) => reminderActions.setDone(id, done),
      removeReminder: (id) => reminderActions.remove(id),
      cancelHangout: (id, canceled) => hangActions.setCanceled(id, canceled),
      rsvpHangout: (id, answer) => hangActions.setRsvp(id, answer),
      groups: groups.map((g) => ({ id: g.id, name: g.name, members: g.members })),
      hangouts: hangouts.map((h) => ({ id: h.id, groupId: h.groupId, title: h.title, place: h.place, when: h.when, canceled: h.canceled })),
      friends: friends.map((f) => ({ id: f.id, name: f.name, username: f.username, relation: "Friend" })),
      unread: { messages: unreadDms(dms.threads), notifs: notifs.filter((n) => n.unread).length },
      findPeople: async (q) => (await searchPeople(q, me, 6)).map((p) => ({ id: p.id, name: p.name, username: p.username, relation: friends.some((f) => f.id === p.id) ? "Friend" : "Student" })),
      addReminder: (t, d, tm) => reminderActions.add(t, d, tm),
      createHangout: (gid, h) => { hangActions.createHangout(gid, h); },
      createGroup: (name, members) => { hangActions.createGroup(name, members); },
      createEvent: async (d) => (await eventActions.create({ ...d, orgKind: d.orgKind as never })).error,
      sendMessage: async (pid, text) => { const t = await dmActions.start(pid); if (!t) return "Could not open that chat."; dmActions.send(t, text); return null; },
    };
  }
  const newChat = () => { setActiveId(null); setFreshId(null); setThinking(false); };
  const select = (id: string) => { setActiveId(id); setFreshId(null); setThinking(false); };
  const remove = (id: string) => { history.remove(id); if (id === activeId) newChat(); };
  const go = (path: string) => { close(); nav(path); };

  const reveal = calm ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const };
  const radius = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y)) + 4;
  const circle = (r: number) => `circle(${r}px at ${origin.x}px ${origin.y}px)`;

  return (
    <>
      <button
        ref={fab}
        type="button"
        className="asst-fab"
        data-side={side}
        data-drag={live ? "" : undefined}
        data-settle={settling ? "" : undefined}
        style={spot ? { left: spot.x, top: spot.y, right: "auto", bottom: "auto" } : undefined}
        aria-label="Ask Orbit"
        aria-haspopup="dialog"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onTransitionEnd={() => setSettling(false)}
        onClick={openFrom}
      >
        <Orb size={50} variant="violet" poke={false} />
        <span className="asst-tip" aria-hidden="true">Ask Orbit</span>
      </button>
      {createPortal(
        <AnimatePresence>
          {mode !== "closed" && (
            <motion.div
              key="layer"
              className="asst-layer"
              role="dialog"
              aria-modal="true"
              aria-label="Orbit assistant"
              initial={{ clipPath: circle(size() / 2) }}
              animate={{ clipPath: circle(radius), transition: reveal }}
              exit={{ clipPath: circle(size() / 2), opacity: 0, transition: calm ? { duration: 0 } : { duration: 0.42, ease: [0.5, 0, 0.75, 0] } }}
              onMouseDown={(e) => { if ((e.target as HTMLElement).classList.contains("mo-bg") && document.querySelector('.mo-root[data-phase="idle"]')) close(); }}
            >
              <div className="asst-scrim" aria-hidden="true" />
              <AnimatePresence>
                {mode === "morph" && (
                  <motion.div key="morph" className="asst-stage" exit={{ opacity: 0, scale: 1.06, filter: "blur(6px)", transition: { duration: calm ? 0 : 0.35 } }}>
                    <MorphOrb onSubmit={ask} onAnswered={answered} />
                    <button type="button" className="asst-x" aria-label="Close the assistant" onClick={close}><X size={20} aria-hidden="true" /></button>
                  </motion.div>
                )}
                {mode === "chat" && (
                  <motion.div
                    key="chat"
                    className="asst-pane"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
                    initial={calm ? false : { opacity: 0, scale: 0.9, y: 28, filter: "blur(8px)" }}
                    animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)", transition: calm ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 24, mass: 0.9 } }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: calm ? 0 : 0.2 } }}
                  >
                    <AssistantChat
                      chats={history.chats}
                      activeId={activeId}
                      freshId={freshId}
                      thinking={thinking}
                      step={step}
                      onDecide={(id, yes) => void decide(id, yes)}
                      onSelect={select}
                      onNew={newChat}
                      onDelete={remove}
                      onClear={() => { history.clear(); newChat(); }}
                      onSend={send}
                      onGo={go}
                      onClose={close}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
