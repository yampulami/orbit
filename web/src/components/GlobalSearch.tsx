import React, { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Avatar from "./Avatar";
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
const PAGES: { id: string; title: string; sub: string; to: string; Icon: LucideIcon; words?: string }[] = [
  { id: "feed", title: "Feed", sub: "What is happening on campus", to: "/app/feed", Icon: Newspaper },
  { id: "messages", title: "Messages", sub: "Your conversations", to: "/app/chats", Icon: MessageSquare, words: "chats dm direct" },
  { id: "groups", title: "Groups", sub: "Your groups and hangouts", to: "/app/chats?tab=groups", Icon: Users },
  { id: "plans", title: "Plans", sub: "Classes, reminders and plans", to: "/app/plans", Icon: CalendarDays },
  { id: "sync", title: "Free time", sub: "Find a time that works for everyone", to: "/app/sync", Icon: CalendarClock, words: "sync schedule calendar find a time" },
  { id: "campus", title: "Campus", sub: "Clubs and events", to: "/app/campus", Icon: Megaphone },
  { id: "roommates", title: "Roommates", sub: "Chores, groceries and expenses", to: "/app/roommates", Icon: Sofa },
  { id: "map", title: "Map", sub: "Places around campus", to: "/app/map", Icon: MapPin },
];
/** The four things people look for most, and everything. Pick one and the search looks only there. */
type Scope = "all" | "posts" | "people" | "campus" | "plans";
const SCOPES: { id: Scope; label: string; Icon?: LucideIcon }[] = [
  { id: "all", label: "Everything" },
  { id: "posts", label: "Posts", Icon: Newspaper },
  { id: "people", label: "People", Icon: UserRound },
  { id: "campus", label: "Clubs and events", Icon: Megaphone },
  { id: "plans", label: "Groups and plans", Icon: Users },
];
const clip = (s: string, n = 70) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** An expanding search dock, after the "Expanding Search Dock" component: a round search button in the top line that grows in place into a pill with the field and a close button.
 *  Results (and a short row of places to look: everything, posts, people, clubs and events, groups and plans) open in a card under it. People are found by name or by username
 *  (starting with @ looks only for usernames). Ctrl or Cmd + K, or "/", opens it; Escape or the X closes it. */
export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("all");
  const [active, setActive] = useState(0);
  const [posts, setPosts] = useState<Row[] | null>(null);
  const [people, setPeople] = useState<PersonHit[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
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
  const openSearch = () => { loadPosts(); setOpen(true); };
  const closeSearch = (giveFocusBack = true) => {
    setOpen(false); setQ(""); setScope("all"); setActive(0);
    if (giveFocusBack) window.setTimeout(() => trigger.current?.focus(), 60);
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (open) closeSearch(); else openSearch(); }
      else if (e.key === "Escape" && open) { e.preventDefault(); closeSearch(); }
    };
    const away = (e: MouseEvent) => { if (open && !box.current?.contains(e.target as Node)) closeSearch(false); };
    const ask = () => openSearch();
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", away);
    window.addEventListener("orbit-search-open", ask);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", away); window.removeEventListener("orbit-search-open", ask); };
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { const t = window.setTimeout(() => input.current?.focus(), 40); return () => window.clearTimeout(t); } }, [open]);

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

  // Typing a page name offers that page.
  const pages = scope === "all" && q.trim() && !usernameOnly ? PAGES.filter((p) => `${p.title} ${p.words ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) : [];
  const options: Option[] = [
    ...pages.map((p): Option => ({ section: "pages", id: p.id, label: p.title, go: () => { closeSearch(false); nav(p.to); } })),
    ...things.map((h): Option => ({ section: "top", id: h.id, label: h.title, go: () => { closeSearch(false); nav(h.to, { state: h.state }); } })),
    ...shownPeople.map((p): Option => ({ section: "people", id: `person-${p.id}`, label: p.name, go: () => { closeSearch(false); nav(`/app/people/${p.id}`); } })),
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
  const idx = (section: Option["section"], id: string) => options.findIndex((o) => o.section === section && o.id === id);
  const label = scoped ? SCOPES.find((s) => s.id === scope)!.label : "";
  const placeholder = scoped ? `Search ${label.toLowerCase()}` : friendsLive ? "Search, or @username" : "Search";
  const noneText = scoped && term.length < 2 ? (scope === "people" ? "Type a name or @username." : `Nothing in ${label.toLowerCase()} yet.`) : `Nothing found for “${q.trim()}”.`;

  const row = (o: Option, i: number, icon: React.ReactNode, title: string, sub: string, kind?: string) => (
    <li key={`${o.section}-${o.id}`} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? "on" : ""} onMouseEnter={() => setActive(i)} onClick={() => o.go()}>
      {icon}
      <span className="gs-text"><strong>{title}</strong><span>{sub}</span></span>
      {kind && <span className="gs-kind">{kind}</span>}
      <ChevronRight className="gs-go" size={18} aria-hidden="true" />
    </li>
  );

  return (
    <div className="gs-dock" ref={box}>
      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          <motion.button key="icon" ref={trigger} type="button" className="gs-icon" aria-label="Search Orbit" aria-haspopup="dialog" title="Search (Ctrl K)"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.15 }} onClick={openSearch}>
            <Search size={20} aria-hidden="true" />
          </motion.button>
        ) : (
          <motion.div key="field" className="gs-open" role="search" onKeyDown={key}
            initial={{ width: 44, opacity: 0 }} animate={{ width: "min(440px, calc(100vw - 32px))", opacity: 1 }} exit={{ width: 44, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
            <motion.div className="gs-pill" initial={{ backdropFilter: "blur(0px)" }} animate={{ backdropFilter: "blur(12px)" }}>
              <Search size={18} aria-hidden="true" className="gs-glass" />
              <input ref={input} type="text" value={q} placeholder={placeholder} aria-label={scoped ? `Search ${label}` : "Search Orbit"} role="combobox" aria-expanded={showResults} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={showResults && options.length ? `${listId}-${active}` : undefined}
                autoComplete="off" spellCheck={false} onChange={(e) => { setQ(e.target.value); setActive(0); }} />
              <motion.button type="button" className="gs-x" aria-label="Close search" initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => closeSearch()}>
                <X size={16} aria-hidden="true" />
              </motion.button>
            </motion.div>
            <div className="gs-card">
              <div className="gs-scopes" role="group" aria-label="Search in">
                {SCOPES.map(({ id, label: l, Icon }) => (
                  <button key={id} type="button" className="gs-scope" aria-pressed={scope === id} onClick={() => pick(id)}>{Icon && <Icon size={14} aria-hidden="true" />}{l}</button>
                ))}
              </div>
              {showResults && (
                <ul id={listId} role="listbox" className="gs-list" aria-label="Search results">
                  {options.length === 0 ? (
                    <li className="gs-none" role="presentation"><MessageSquare size={16} aria-hidden="true" />{noneText}{scoped ? <button type="button" className="gs-more" onClick={() => pick("all")}>Search everything</button> : <button type="button" className="gs-more" onClick={() => { setQ(""); input.current?.focus(); }}>Clear</button>}</li>
                  ) : (
                    <>
                      {pages.length > 0 && <li className="gs-head" role="presentation">Go to</li>}
                      {pages.map((p) => { const i = idx("pages", p.id); return row(options[i], i, <span className="gs-ico"><p.Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span>, p.title, p.sub); })}
                      {things.length > 0 && <li className="gs-head" role="presentation">{scoped ? (longEnough(q) ? "Results" : "Closest") : "Top results"}</li>}
                      {things.map((h) => { const i = idx("top", h.id); return row(options[i], i, <span className="gs-ico"><h.Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span>, h.title, h.sub, h.kind); })}
                      {shownPeople.length > 0 && <li className="gs-head" role="presentation">{scope === "people" && !longEnough(q) ? "Your friends" : "People"}</li>}
                      {shownPeople.map((p) => { const i = idx("people", `person-${p.id}`); return row(options[i], i, <Avatar name={p.name} id={p.id} size={32} className="gs-ico gs-av" />, p.name, p.username ? `@${p.username}` : "No username yet", relation(p.id)); })}
                    </>
                  )}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
