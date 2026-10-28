import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarDays, Coffee, ListChecks, MessageSquare, Newspaper, NotebookText, Search, ShoppingBasket, Users, X, type LucideIcon } from "lucide-react";
import { useAuth } from "../lib/auth";
import { feedApi, type Row } from "../lib/feedData";
import { friendsLive, useFriends } from "../lib/friends";
import { useHang } from "../lib/hangouts";
import { longEnough, parseQuery, searchPeople, type PersonHit } from "../lib/peopleSearch";
import { fromYmd, useReminders } from "../lib/reminders";
import { useSpace } from "../lib/roommates";

type Hit = { id: string; kind: string; Icon: LucideIcon; title: string; sub: string; to: string; state?: Record<string, unknown> };
/** One row in the list under the search box, whichever section it is in. */
type Option = { section: "top" | "people"; id: string; go: () => void };
const clip = (s: string, n = 70) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const TOP_MAX = 4;

/** Search as you type. The first section is what matches in Orbit (posts, hangouts, chores, groups...), the second is people, found by name or by
 *  username. Starting with @ looks only for usernames. Ctrl or Cmd + K focuses it. */
export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false); // on a phone the box is an icon until tapped
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

  // Posts load the first time the box is used.
  const loadPosts = () => { if (posts === null) { setPosts([]); feedApi.list().then(setPosts).catch(() => setPosts([])); } };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); } };
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", away);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", away); };
  }, []);

  // People are looked up a moment after you stop typing, and only the answer to the latest letters is used.
  useEffect(() => {
    if (!friendsLive || !longEnough(q)) { setPeople([]); return; }
    let current = true;
    const t = setTimeout(() => { void searchPeople(q, me).then((r) => { if (current) setPeople(r); }); }, 160);
    return () => { current = false; clearTimeout(t); };
  }, [q, me]);

  const { term, usernameOnly } = parseQuery(q);

  const things = useMemo<Hit[]>(() => {
    if (usernameOnly || term.length < 2) return [];
    const has = (...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(term));
    const out: Hit[] = [];
    for (const h of hangouts) if (!h.canceled && has(h.title, h.place)) out.push({ id: `h${h.id}`, kind: "Hangout", Icon: Coffee, title: h.title, sub: `${new Date(h.when).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${h.place}`, to: "/app/plans", state: { day: new Date(h.when).toDateString() } });
    for (const r of reminders) if (has(r.title)) out.push({ id: `r${r.id}`, kind: "Reminder", Icon: Bell, title: r.title, sub: fromYmd(r.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }), to: "/app/plans", state: { day: fromYmd(r.date).toDateString() } });
    if (space) {
      for (const t of space.tasks) if (has(t.title, t.assignee)) out.push({ id: `t${t.id}`, kind: "Chore", Icon: ListChecks, title: t.title, sub: `${t.assignee} · ${t.points} pt${t.points === 1 ? "" : "s"}${t.done ? " · done" : ""}`, to: "/app/roommates", state: { section: "tasks" } });
      for (const g of space.groceries) if (has(g.name, g.category)) out.push({ id: `g${g.id}`, kind: "Grocery", Icon: ShoppingBasket, title: g.name, sub: `${g.category}${g.bought ? " · purchased" : ""}`, to: "/app/roommates", state: { section: "groceries" } });
      for (const e of space.expenses) if (has(e.item)) out.push({ id: `e${e.id}`, kind: "Expense", Icon: CalendarDays, title: e.item, sub: `Paid by ${e.paidBy}`, to: "/app/roommates", state: { section: "expenses" } });
      for (const n of space.notes) if (has(n.title, n.body)) out.push({ id: `n${n.id}`, kind: "House note", Icon: NotebookText, title: n.title, sub: clip(n.body), to: "/app/roommates", state: { section: "notes" } });
    }
    for (const g of groups) if (has(g.name, ...g.members)) out.push({ id: `grp${g.id}`, kind: "Group", Icon: Users, title: g.name, sub: g.members.join(", "), to: "/app/groups", state: { group: g.id } });
    for (const p of posts ?? []) if (has(p.payload.body, p.payload.text, p.payload.title, p.author_name)) out.push({ id: `p${p.id}`, kind: "Post", Icon: Newspaper, title: clip(p.payload.body ?? p.payload.text ?? p.payload.title ?? ""), sub: `${p.author_name} · ${p.community}`, to: "/app/feed" });
    return out.slice(0, TOP_MAX);
  }, [term, usernameOnly, hangouts, reminders, space, groups, posts]);

  const close = () => { setOpen(false); setQ(""); };
  const options: Option[] = [
    ...things.map((h): Option => ({ section: "top", id: h.id, go: () => { close(); nav(h.to, { state: h.state }); } })),
    ...people.map((p): Option => ({ section: "people", id: `person-${p.id}`, go: () => { close(); nav(`/app/people/${p.id}`); } })),
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

  const showPanel = open && longEnough(q);
  const idx = (section: Option["section"], id: string) => options.findIndex((o) => o.section === section && o.id === id);

  return (
    <>
    {showPanel && <div className="gs-dim" aria-hidden="true" />}
    <div className={"gsearch" + (phoneOpen ? " phone-open" : "") + (showPanel ? " has-panel" : "")} ref={root} role="search" onKeyDown={key}>
      <button type="button" className="gs-toggle" aria-label="Search" aria-expanded={phoneOpen} onClick={() => { setPhoneOpen(true); setTimeout(() => input.current?.focus(), 50); }}><Search size={20} aria-hidden="true" /></button>
      <Search size={18} aria-hidden="true" className="gs-glass" />
      <input ref={input} type="search" value={q} placeholder={friendsLive ? "Search, or @username" : "Search"} aria-label="Search Orbit" role="combobox" aria-expanded={showPanel} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={showPanel && options.length ? `${listId}-${active}` : undefined}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }} onFocus={() => { loadPosts(); setOpen(true); }} />
      <kbd aria-hidden="true">Ctrl K</kbd>
      <button type="button" className="gs-close" aria-label="Close search" onClick={() => { setPhoneOpen(false); setOpen(false); setQ(""); }}><X size={20} aria-hidden="true" /></button>
      {showPanel && (
        <ul id={listId} role="listbox" className="gs-panel" aria-label="Search results">
          {options.length === 0 ? (
            <li className="gs-none" role="presentation"><MessageSquare size={16} aria-hidden="true" />Nothing found for “{q.trim()}”.</li>
          ) : (
            <>
              {things.length > 0 && <li className="gs-head" role="presentation">Top results</li>}
              {things.map((h) => {
                const i = idx("top", h.id);
                return (
                  <li key={h.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? "on" : ""} onMouseEnter={() => setActive(i)} onClick={() => options[i].go()}>
                    <span className="gs-ico"><h.Icon size={16} strokeWidth={1.9} aria-hidden="true" /></span>
                    <span className="gs-text"><strong>{h.title}</strong><span>{h.sub}</span></span>
                    <span className="gs-kind">{h.kind}</span>
                  </li>
                );
              })}
              {people.length > 0 && <li className="gs-head" role="presentation">People</li>}
              {people.map((p) => {
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
          <li className="gs-foot" role="presentation"><span>↑ ↓ to move</span><span>Enter to open</span><span>Esc to close</span></li>
        </ul>
      )}
    </div>
    </>
  );
}
