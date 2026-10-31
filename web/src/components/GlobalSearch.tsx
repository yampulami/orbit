import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarClock, CalendarDays, Coffee, ListChecks, MapPin, Megaphone, MessageSquare, Newspaper, NotebookText, Search, Sofa, ShoppingBasket, Users, X, type LucideIcon } from "lucide-react";
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
/** One row in the list under the search box, whichever section it is in. */
type Option = { section: "top" | "people" | "pages"; id: string; go: () => void };
/** Where you can jump to from the search box before you have typed anything. */
const PAGES: { id: string; title: string; sub: string; to: string; Icon: LucideIcon }[] = [
  { id: "feed", title: "Feed", sub: "What is happening on campus", to: "/app/feed", Icon: Newspaper },
  { id: "messages", title: "Messages", sub: "Your conversations", to: "/app/chats", Icon: MessageSquare },
  { id: "groups", title: "Groups", sub: "Your groups and hangouts", to: "/app/chats?tab=groups", Icon: Users },
  { id: "plans", title: "Plans", sub: "Classes, reminders and plans", to: "/app/plans", Icon: CalendarDays },
  { id: "sync", title: "Schedule sync", sub: "Find a time that works for everyone", to: "/app/sync", Icon: CalendarClock },
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
const clip = (s: string, n = 70) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** Search as you type. Click the bar and a row of text choices (everything, posts, people, clubs and events, groups and plans) sits above the results; pick one to search just there.
 *  With none picked it looks everywhere in Orbit, and people are found by name or by username (starting with @ looks only for usernames). Ctrl or Cmd + K focuses it. */
export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false); // on a phone the box is an icon until tapped
  const [scope, setScope] = useState<Scope>("all");
  const [active, setActive] = useState(0);
  const [posts, setPosts] = useState<Row[] | null>(null);
  const [people, setPeople] = useState<PersonHit[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
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

  // Posts load the first time the box is used.
  const loadPosts = () => { if (posts === null) { setPosts([]); feedApi.list().then(setPosts).catch(() => setPosts([])); } };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); } };
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", away);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", away); };
  }, []);

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
    return out.slice(0, limit);
  }, [term, usernameOnly, scope, scoped, limit, hangouts, reminders, space, groups, posts, orgs, events]);

  const close = () => { setOpen(false); setQ(""); };
  const pages = scope === "all" && !longEnough(q) ? PAGES.filter((p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase())) : [];
  const options: Option[] = [
    ...pages.map((p): Option => ({ section: "pages", id: p.id, go: () => { close(); nav(p.to); } })),
    ...things.map((h): Option => ({ section: "top", id: h.id, go: () => { close(); nav(h.to, { state: h.state }); } })),
    ...shownPeople.map((p): Option => ({ section: "people", id: `person-${p.id}`, go: () => { close(); nav(`/app/people/${p.id}`); } })),
  ];

  /** How you stand with a person in the results, for the small label on the right. */
  const relation = (id: string) =>
    friends.some((f) => f.id === id) ? "Friend" : outgoing.some((r) => r.to.id === id) ? "Requested" : incoming.some((r) => r.from.id === id) ? "Wants to add you" : "Person";

  function key(e: KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); input.current?.blur(); return; }
    if (!options.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % options.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a + options.length - 1) % options.length); }
    else if (e.key === "Enter" && open) { e.preventDefault(); options[Math.min(active, options.length - 1)].go(); }
  }

  const pick = (s: Scope) => { setScope(s); setActive(0); setOpen(true); loadPosts(); setTimeout(() => input.current?.focus(), 0); };
  const showPanel = open && (longEnough(q) || scoped || pages.length > 0);
  const idx = (section: Option["section"], id: string) => options.findIndex((o) => o.section === section && o.id === id);
  const label = scoped ? SCOPES.find((s) => s.id === scope)!.label : "";
  const placeholder = scoped ? label : friendsLive ? "Search, or @username" : "Search";

  const scopeRow = (
    <div className="gs-scopes" role="group" aria-label="Search in">
      {SCOPES.map(({ id, label: l }) => (
        <button key={id} type="button" className="gs-scope" aria-pressed={scope === id} onClick={() => pick(id)}>{l}</button>
      ))}
    </div>
  );

  const noneText = scoped && term.length < 2 ? (scope === "people" ? "Type a name or @username." : `Nothing in ${label.toLowerCase()} yet.`) : `Nothing found for “${q.trim()}”.`;

  return (
    <>
      {showPanel && <div className="gs-dim" aria-hidden="true" />}
      <div className={"gs-row" + (open ? " open" : "")} ref={root}>
        <div className={"gsearch" + (phoneOpen ? " phone-open" : "") + (showPanel ? " has-panel" : "")} role="search" onKeyDown={key} onClick={(e) => { if (!(e.target as HTMLElement).closest("button,li")) input.current?.focus(); }}>
          <button type="button" className="gs-toggle" aria-label="Search" aria-expanded={phoneOpen} onClick={() => { setPhoneOpen(true); setTimeout(() => input.current?.focus(), 50); }}><Search size={20} aria-hidden="true" /></button>
          <Search size={18} aria-hidden="true" className="gs-glass" />
          <input ref={input} type="search" value={q} placeholder={placeholder} aria-label={scoped ? `Search ${label}` : "Search Orbit"} role="combobox" aria-expanded={showPanel} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={showPanel && options.length ? `${listId}-${active}` : undefined}
            onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }} onFocus={() => { loadPosts(); setOpen(true); }} />
          <kbd aria-hidden="true">Ctrl K</kbd>
          <button type="button" className="gs-close" aria-label="Close search" onClick={() => { setPhoneOpen(false); setOpen(false); setQ(""); setScope("all"); }}><X size={20} aria-hidden="true" /></button>
          {showPanel && (
            <ul id={listId} role="listbox" className="gs-panel" aria-label="Search results">
              <li className="gs-chips" role="presentation">{scopeRow}</li>
              {options.length === 0 ? (
                <li className="gs-none" role="presentation"><MessageSquare size={16} aria-hidden="true" />{noneText}</li>
              ) : (
                <>
                  {pages.length > 0 && <li className="gs-head" role="presentation">Go to</li>}
                  {pages.map((p) => {
                    const i = idx("pages", p.id);
                    return (
                      <li key={p.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? "on" : ""} onMouseEnter={() => setActive(i)} onClick={() => options[i].go()}>
                        <span className="gs-ico"><p.Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
                        <span className="gs-text"><strong>{p.title}</strong><span>{p.sub}</span></span>
                      </li>
                    );
                  })}
                  {things.length > 0 && <li className="gs-head" role="presentation">{scoped ? (longEnough(q) ? "Results" : "Closest") : "Top results"}</li>}
                  {things.map((h) => {
                    const i = idx("top", h.id);
                    return (
                      <li key={h.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? "on" : ""} onMouseEnter={() => setActive(i)} onClick={() => options[i].go()}>
                        <span className="gs-ico"><h.Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
                        <span className="gs-text"><strong>{h.title}</strong><span>{h.sub}</span></span>
                        <span className="gs-kind">{h.kind}</span>
                      </li>
                    );
                  })}
                  {shownPeople.length > 0 && <li className="gs-head" role="presentation">{scope === "people" && !longEnough(q) ? "Your friends" : "People"}</li>}
                  {shownPeople.map((p) => {
                    const i = idx("people", `person-${p.id}`);
                    return (
                      <li key={p.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? "on" : ""} onMouseEnter={() => setActive(i)} onClick={() => options[i].go()}>
                        <span className="gs-ico gs-av" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
                        <span className="gs-text"><strong>{p.name}</strong><span>{p.username ? `@${p.username}` : "No username yet"}</span></span>
                        <span className="gs-kind">{relation(p.id)}</span>
                      </li>
                    );
                  })}
                </>
              )}
              <li className="gs-foot" role="presentation"><span>↑ ↓ move</span><span>Enter open</span><span>Esc close</span></li>
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
