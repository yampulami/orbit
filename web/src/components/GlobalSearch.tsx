import React, { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarClock, ChevronRight, CalendarDays, Coffee, ListChecks, MapPin, Megaphone, MessageSquare, Newspaper, NotebookText, Search, Sofa, ShoppingBasket, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { useAuth } from "../lib/auth";
import { feedApi, type Row } from "../lib/feedData";
import { friendsLive, useFriends } from "../lib/friends";
import { useHang } from "../lib/hangouts";
import { longEnough, parseQuery, searchPeople, type PersonHit } from "../lib/peopleSearch";
import { fromYmd, useReminders } from "../lib/reminders";
import { useSpace } from "../lib/roommates";
import { useCampusOrgs } from "../lib/campusOrgs";
import { isOpen, useCampusEvents } from "../lib/campusEvents";

type Hit = { id: string; kind: string; Icon: LucideIcon; title: string; sub: string; to: string; state?: Record<string, unknown> };
/** One row in the results, whichever section it is in. */
type Option = { section: "top" | "people" | "pages"; id: string; label: string; go: () => void };
/** Pages you can jump to by typing their name. */
const PAGES: { id: string; title: string; sub: string; to: string; Icon: LucideIcon }[] = [
  { id: "feed", title: "Feed", sub: "What is happening on campus", to: "/app/feed", Icon: Newspaper },
  { id: "messages", title: "Messages", sub: "Your conversations", to: "/app/chats", Icon: MessageSquare },
  { id: "groups", title: "Groups", sub: "Your groups and hangouts", to: "/app/chats?tab=groups", Icon: Users },
  { id: "plans", title: "Plans", sub: "Classes, reminders and plans", to: "/app/plans", Icon: CalendarDays },
  { id: "sync", title: "Free time", sub: "Find a time that works for everyone", to: "/app/sync", Icon: CalendarClock },
  { id: "campus", title: "Campus", sub: "Clubs and events", to: "/app/campus", Icon: Megaphone },
  { id: "roommates", title: "Roommates", sub: "Chores, groceries and expenses", to: "/app/roommates", Icon: Sofa },
  { id: "map", title: "Map", sub: "Places around campus", to: "/app/map", Icon: MapPin },
];
/** The four things people look for most, and everything. Pick one and the search looks only there. */
type Scope = "all" | "posts" | "people" | "campus" | "plans";
const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "posts", label: "Posts" },
  { id: "people", label: "People" },
  { id: "campus", label: "Clubs and events" },
  { id: "plans", label: "Groups and plans" },
];
/** The round buttons that slide out beside the search bar. Point at one and the empty bar names it; pick one to search only there. */
const CIRCLES: { id: Exclude<Scope, "all">; label: string; Icon: LucideIcon }[] = [
  { id: "posts", label: "Posts", Icon: Newspaper },
  { id: "people", label: "People", Icon: UserRound },
  { id: "campus", label: "Clubs and events", Icon: Megaphone },
  { id: "plans", label: "Groups and plans", Icon: Users },
];
const clip = (s: string, n = 70) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** A Spotlight-style search. The bar in the top line opens a centred search over the page: type to see results inside it, point at a round button to name it,
 *  pick one to search only there. With none picked it looks everywhere in Orbit; people are found by name or by username (starting with @ looks only for usernames).
 *  Ctrl or Cmd + K, or "/", opens it; Escape closes it. */
export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("all");
  const [active, setActive] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null); // the row under the mouse, whose name the empty bar borrows as its placeholder
  const [hoverScope, setHoverScope] = useState<number | null>(null);
  const [posts, setPosts] = useState<Row[] | null>(null);
  const [people, setPeople] = useState<PersonHit[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const came = useRef<HTMLElement | null>(null); // where focus was before the search opened, so closing can give it back
  const listId = useId();
  const nav = useNavigate();
  const { session } = useAuth();
  const me = session?.user.id;
  const { groups, hangouts } = useHang();
  const space = useSpace();
  const reminders = useReminders();
  const { friends, outgoing, incoming } = useFriends();
  const { orgs } = useCampusOrgs();
  const { events } = useCampusEvents();

  // Posts load the first time the search is opened.
  const loadPosts = () => { if (posts === null) { setPosts([]); feedApi.list().then(setPosts).catch(() => setPosts([])); } };
  const openSearch = () => { came.current = document.activeElement as HTMLElement | null; loadPosts(); setOpen(true); };
  const closeSearch = () => {
    setOpen(false); setQ(""); setScope("all"); setActive(0); setHoverIdx(null); setHoverScope(null);
    window.setTimeout(() => { if (came.current?.isConnected) came.current.focus(); }, 0);
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (open) closeSearch(); else openSearch(); }
      else if (e.key === "Escape" && open) { e.preventDefault(); closeSearch(); }
    };
    const ask = () => openSearch();
    window.addEventListener("keydown", onKey);
    window.addEventListener("orbit-search-open", ask);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("orbit-search-open", ask); };
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { const t = window.setTimeout(() => input.current?.focus(), 30); return () => window.clearTimeout(t); } }, [open]);

  const { term, usernameOnly } = parseQuery(q);
  const scoped = scope !== "all";
  const wantPeople = !scoped || scope === "people";

  // People are looked up a moment after you stop typing, and only the answer to the latest letters is used.
  useEffect(() => {
    if (!friendsLive || !wantPeople || !longEnough(q)) { setPeople([]); return; }
    let current = true;
    const t = setTimeout(() => { void searchPeople(q, me).then((r) => { if (current) setPeople(r); }); }, 160);
    return () => { current = false; clearTimeout(t); };
  }, [q, me, wantPeople]);

  // With People picked and nothing typed yet, show your friends.
  const shownPeople: PersonHit[] = scope === "people" && !longEnough(q) ? friends.slice(0, 8).map((f) => ({ id: f.id, name: f.name, username: f.username })) : people;

  const limit = scoped ? 8 : 4;
  const things = useMemo<Hit[]>(() => {
    if (usernameOnly || scope === "people") return [];
    if (!scoped && term.length < 2) return [];
    const has = (...s: (string | undefined)[]) => term.length < 2 || s.some((x) => x?.toLowerCase().includes(term));
    const out: Hit[] = [];
    const now = new Date();
    const fromPlans = scope === "all" || scope === "plans";
    const fromCampus = scope === "all" || scope === "campus";
    const fromPosts = scope === "all" || scope === "posts";
    if (fromPlans) {
      for (const h of hangouts) if (!h.canceled && new Date(h.when).getTime() > Date.now() - 3 * 3600000 && has(h.title, h.place)) out.push({ id: `h${h.id}`, kind: "Hangout", Icon: Coffee, title: h.title, sub: `${day(h.when)} · ${h.place}`, to: "/app/plans", state: { day: new Date(h.when).toDateString() } });
      for (const g of groups) if (has(g.name, ...g.members)) out.push({ id: `grp${g.id}`, kind: "Group", Icon: Users, title: g.name, sub: g.members.join(", "), to: "/app/groups", state: { group: g.id } });
      for (const r of reminders) if (!r.done && has(r.title)) out.push({ id: `r${r.id}`, kind: "Reminder", Icon: Bell, title: r.title, sub: day(fromYmd(r.date).toISOString()), to: "/app/plans", state: { day: fromYmd(r.date).toDateString() } });
    }
    if (fromCampus) {
      for (const o of orgs) if (o.status === "active" && has(o.name, o.description, o.application.category)) out.push({ id: `o${o.id}`, kind: o.kind === "circle" ? "Circle" : "Club", Icon: Megaphone, title: o.name, sub: clip(o.description || o.application.category || "Open its page"), to: `/app/campus/clubs/${o.id}` });
      for (const e of events) if (e.status === "published" && !e.canceled && isOpen(e, now) && has(e.title, e.host, e.place, e.description)) out.push({ id: `e${e.id}`, kind: "Event", Icon: CalendarDays, title: e.title, sub: `${day(e.startsAt)} · ${e.host}`, to: e.orgId ? `/app/campus/clubs/${e.orgId}` : "/app/campus" });
    }
    if (scope === "all" && space) {
      for (const t of space.tasks) if (has(t.title, t.assignee)) out.push({ id: `t${t.id}`, kind: "Chore", Icon: ListChecks, title: t.title, sub: `${t.assignee} · ${t.points} pt${t.points === 1 ? "" : "s"}${t.done ? " · done" : ""}`, to: "/app/roommates", state: { section: "tasks" } });
      for (const g of space.groceries) if (has(g.name, g.category)) out.push({ id: `g${g.id}`, kind: "Grocery", Icon: ShoppingBasket, title: g.name, sub: `${g.category}${g.bought ? " · purchased" : ""}`, to: "/app/roommates", state: { section: "groceries" } });
      for (const e of space.expenses) if (has(e.item)) out.push({ id: `x${e.id}`, kind: "Expense", Icon: CalendarDays, title: e.item, sub: `Paid by ${e.paidBy}`, to: "/app/roommates", state: { section: "expenses" } });
      for (const n of space.notes) if (has(n.title, n.body)) out.push({ id: `n${n.id}`, kind: "House note", Icon: NotebookText, title: n.title, sub: clip(n.body), to: "/app/roommates", state: { section: "notes" } });
    }
    if (fromPosts) for (const p of posts ?? []) if (has(p.payload.body, p.payload.text, p.payload.title, p.author_name)) out.push({ id: `p${p.id}`, kind: "Post", Icon: Newspaper, title: clip(p.payload.body ?? p.payload.text ?? p.payload.title ?? ""), sub: `${p.author_name} · ${p.community}`, to: "/app/feed" });
    if (scoped) return out.slice(0, limit);
    // Everywhere: each kind of thing gets room, so posts are not crowded out by plans and reminders.
    const family = (id: string) => (id.startsWith("p") ? "posts" : /^(h|grp|r)/.test(id) ? "plans" : /^(o|e)/.test(id) ? "campus" : "home");
    const order = ["posts", "plans", "campus", "home"];
    const taken: Record<string, number> = {};
    return out.filter((h) => { const f = family(h.id); taken[f] = (taken[f] ?? 0) + 1; return taken[f] <= 2; }).sort((a, b) => order.indexOf(family(a.id)) - order.indexOf(family(b.id)));
  }, [term, usernameOnly, scope, scoped, limit, hangouts, reminders, space, groups, posts, orgs, events]);

  // Typing a page name offers that page; with nothing typed the bar stays clean, like Spotlight.
  const pages = scope === "all" && !longEnough(q) && q.trim() ? PAGES.filter((p) => p.title.toLowerCase().includes(q.trim().toLowerCase())) : [];
  const options: Option[] = [
    ...pages.map((p): Option => ({ section: "pages", id: p.id, label: p.title, go: () => { closeSearch(); nav(p.to); } })),
    ...things.map((h): Option => ({ section: "top", id: h.id, label: h.title, go: () => { closeSearch(); nav(h.to, { state: h.state }); } })),
    ...shownPeople.map((p): Option => ({ section: "people", id: `person-${p.id}`, label: p.name, go: () => { closeSearch(); nav(`/app/people/${p.id}`); } })),
  ];

  /** How you stand with a person in the results, for the small label on the right. */
  const relation = (id: string) =>
    friends.some((f) => f.id === id) ? "Friend" : outgoing.some((r) => r.to.id === id) ? "Requested" : incoming.some((r) => r.from.id === id) ? "Wants to add you" : "Person";

  function key(e: KeyboardEvent) {
    if (!options.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a + options.length - 1) % options.length); }
    else if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); options[Math.min(active, options.length - 1)].go(); }
  }

  const pick = (s: Scope) => { setScope(s); setActive(0); loadPosts(); window.setTimeout(() => input.current?.focus(), 0); };
  const typed = q.trim().length > 0;
  const showResults = typed || scoped;
  const showCircles = !typed;
  const idx = (section: Option["section"], id: string) => options.findIndex((o) => o.section === section && o.id === id);
  const label = scoped ? SCOPES.find((s) => s.id === scope)!.label : "";
  const hovered = hoverScope !== null ? CIRCLES[hoverScope].label : hoverIdx !== null && !typed ? options[hoverIdx]?.label : undefined;
  const placeholder = hovered ?? (scoped ? label : friendsLive ? "Search, or @username" : "Search");
  const noneText = scoped && term.length < 2 ? (scope === "people" ? "Type a name or @username." : `Nothing in ${label.toLowerCase()} yet.`) : `Nothing found for “${q.trim()}”.`;

  const row = (o: Option, i: number, icon: React.ReactNode, title: string, sub: string, kind?: string) => (
    <motion.li key={`${o.section}-${o.id}`} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? "on" : ""}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.18, ease: "easeOut" }}
      onMouseEnter={() => { setActive(i); setHoverIdx(i); }} onClick={() => o.go()}>
      {icon}
      <span className="gs-text"><strong>{title}</strong><span>{sub}</span></span>
      {kind && <span className="gs-kind">{kind}</span>}
      <ChevronRight className="gs-go" size={20} aria-hidden="true" />
    </motion.li>
  );

  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div key="gs" className="gs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeSearch(); }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
            <filter id="gs-blob"><feGaussianBlur stdDeviation="10" in="SourceGraphic" /><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -9" result="blob" /><feBlend in="SourceGraphic" in2="blob" /></filter>
          </svg>
          <motion.div className="gs-stage" role="dialog" aria-modal="true" aria-label="Search Orbit" onKeyDown={key}
            initial={{ opacity: 0, scale: 1.04, y: -10, filter: "blur(12px)" }} animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 1.04, y: 6, filter: "blur(12px)" }} transition={{ type: "spring", stiffness: 550, damping: 50 }}>
            <div className="gs-line" onMouseLeave={() => setHoverScope(null)}>
              <motion.div layout className="gs-pill" transition={{ layout: { duration: 0.4, type: "spring", bounce: 0.2 } }}>
                <div className="gs-bar">
                  <Search size={22} strokeWidth={1.6} aria-hidden="true" />
                  <div className="gs-field">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {!typed && <motion.span key={placeholder} className={"gs-ph" + (hovered ? " lit" : "")} aria-hidden="true" initial={{ opacity: 0, y: 10, filter: "blur(5px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(5px)" }} transition={{ duration: 0.2, ease: "easeOut" }}>{placeholder}</motion.span>}
                    </AnimatePresence>
                    <input ref={input} type="text" value={q} aria-label={scoped ? `Search ${label}` : "Search Orbit"} role="combobox" aria-expanded={showResults} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={showResults && options.length ? `${listId}-${active}` : undefined}
                      autoComplete="off" spellCheck={false} onChange={(e) => { setQ(e.target.value); setActive(0); }} />
                  </div>
                  {scoped && <button type="button" className="gs-chip" aria-label={`Searching ${label}. Search everything instead`} onClick={() => pick("all")}>{label}<X size={14} aria-hidden="true" /></button>}
                  <kbd aria-hidden="true">Esc</kbd>
                </div>
                {showResults && (
                  <motion.ul layout id={listId} role="listbox" className="gs-list" aria-label="Search results" onMouseLeave={() => setHoverIdx(null)}>
                    {options.length === 0 ? (
                      <li className="gs-none" role="presentation"><MessageSquare size={16} aria-hidden="true" />{noneText}{scoped ? <button type="button" className="gs-more" onClick={() => pick("all")}>Search everything</button> : <button type="button" className="gs-more" onClick={() => { setQ(""); input.current?.focus(); }}>Clear</button>}</li>
                    ) : (
                      <>
                        {pages.length > 0 && <li className="gs-head" role="presentation">Go to</li>}
                        {pages.map((p) => { const i = idx("pages", p.id); return row(options[i], i, <span className="gs-ico"><p.Icon size={20} strokeWidth={1.6} aria-hidden="true" /></span>, p.title, p.sub); })}
                        {things.length > 0 && <li className="gs-head" role="presentation">{scoped ? (longEnough(q) ? "Results" : "Closest") : "Top results"}</li>}
                        {things.map((h) => { const i = idx("top", h.id); return row(options[i], i, <span className="gs-ico"><h.Icon size={20} strokeWidth={1.6} aria-hidden="true" /></span>, h.title, h.sub, h.kind); })}
                        {shownPeople.length > 0 && <li className="gs-head" role="presentation">{scope === "people" && !longEnough(q) ? "Your friends" : "People"}</li>}
                        {shownPeople.map((p) => { const i = idx("people", `person-${p.id}`); return row(options[i], i, <span className="gs-ico gs-av" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>, p.name, p.username ? `@${p.username}` : "No username yet", relation(p.id)); })}
                      </>
                    )}
                    <li className="gs-foot" role="presentation"><span>↑ ↓ move</span><span>Enter open</span><span>Esc close</span></li>
                  </motion.ul>
                )}
              </motion.div>
              <AnimatePresence>
                {showCircles && CIRCLES.map(({ id, label: l, Icon }, i) => (
                  <motion.button key={id} type="button" layout className="gs-circle" aria-pressed={scope === id} aria-label={l} title={l}
                    onMouseEnter={() => setHoverScope(i)} onFocus={() => setHoverScope(i)} onBlur={() => setHoverScope(null)} onClick={() => pick(scope === id ? "all" : id)}
                    initial={{ scale: 0.7, x: -1 * (64 * (i + 1)) }} animate={{ scale: 1, x: 0 }} exit={{ scale: 0.7, x: 16 * (CIRCLES.length - i - 1) + 64 * (CIRCLES.length - i - 1) }}
                    transition={{ duration: 0.7, type: "spring", bounce: 0.2, delay: i * 0.05 }}>
                    <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div className="gs-row">
        <button type="button" className="gs-trigger" aria-haspopup="dialog" aria-label="Search Orbit" onClick={openSearch}>
          <Search size={18} aria-hidden="true" />
          <span className="gs-trigger-t">Search</span>
          <kbd aria-hidden="true">Ctrl K</kbd>
        </button>
      </div>
      {typeof document !== "undefined" && createPortal(overlay, document.body)}
    </>
  );
}
