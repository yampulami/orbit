import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarDays, Coffee, ListChecks, MessageSquare, Newspaper, NotebookText, Search, ShoppingBasket, Users, type LucideIcon } from "lucide-react";
import { feedApi, type Row } from "../lib/feedData";
import { useHang } from "../lib/hangouts";
import { fromYmd, useReminders } from "../lib/reminders";
import { useSpace } from "../lib/roommates";

type Hit = { id: string; kind: string; Icon: LucideIcon; title: string; sub: string; to: string; state?: Record<string, unknown> };
const clip = (s: string, n = 70) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Search across posts, hangouts, chores, groceries, notes, reminders and groups. Ctrl or Cmd + K focuses it. */
export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [posts, setPosts] = useState<Row[] | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const nav = useNavigate();
  const { groups, hangouts } = useHang();
  const space = useSpace();
  const reminders = useReminders();

  // Posts load the first time the box is used.
  const loadPosts = () => { if (posts === null) { setPosts([]); feedApi.list().then(setPosts).catch(() => setPosts([])); } };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); } };
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", away);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", away); };
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
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
    return out.slice(0, 8);
  }, [q, hangouts, reminders, space, groups, posts]);

  const go = (h: Hit) => { setOpen(false); setQ(""); nav(h.to, { state: h.state }); };

  function key(e: KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); input.current?.blur(); return; }
    if (!hits.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % hits.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a + hits.length - 1) % hits.length); }
    else if (e.key === "Enter" && open) { e.preventDefault(); go(hits[Math.min(active, hits.length - 1)]); }
  }

  const showPanel = open && q.trim().length >= 2;

  return (
    <div className="gsearch" ref={root} role="search" onKeyDown={key}>
      <Search size={18} aria-hidden="true" />
      <input ref={input} type="search" value={q} placeholder="Search" aria-label="Search Orbit" role="combobox" aria-expanded={showPanel} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={showPanel && hits.length ? `${listId}-${active}` : undefined}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }} onFocus={() => { loadPosts(); setOpen(true); }} />
      <kbd aria-hidden="true">Ctrl K</kbd>
      {showPanel && (
        <ul id={listId} role="listbox" className="gs-panel" aria-label="Search results">
          {hits.length === 0 ? (
            <li className="gs-none" role="presentation"><MessageSquare size={16} aria-hidden="true" />Nothing found for “{q.trim()}”.</li>
          ) : hits.map((h, i) => (
            <li key={h.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? "on" : ""} onMouseEnter={() => setActive(i)} onClick={() => go(h)}>
              <span className="gs-ico"><h.Icon size={16} strokeWidth={1.9} aria-hidden="true" /></span>
              <span className="gs-text"><strong>{h.title}</strong><span>{h.sub}</span></span>
              <span className="gs-kind">{h.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
