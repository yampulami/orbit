import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/** Marketplace: things students sell, give away, or are looking for, seen only by their own campus. Orbit never handles money:
 *  a price is information, and buyer and seller settle the rest in a message. In demo mode listings live in this browser. */
export type Kind = "sell" | "free" | "wanted";
export type Status = "active" | "sold" | "removed";
export const CATEGORIES = ["Textbooks", "Furniture", "Electronics", "Clothing", "Dorm and kitchen", "Bikes and rides", "Tickets", "Services", "Other"] as const;
export const CONDITIONS = ["New", "Like new", "Good", "Fair"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Condition = (typeof CONDITIONS)[number];
export const KIND_LABEL: Record<Kind, string> = { sell: "For sale", free: "Free", wanted: "Wanted" };
export const MAX_ACTIVE = 12;

export type Listing = {
  id: string; campusKey: string; sellerId: string; sellerName: string; kind: Kind; title: string; description: string;
  priceCents: number | null; category: Category; condition: Condition | null; photos: string[]; status: Status; createdAt: string; soldAt?: string; mine: boolean; saved: boolean;
};
type Row = { id: string; campus_key: string; seller_id: string; seller_name: string; kind: Kind; title: string; description: string; price_cents: number | null; category: Category; condition: Condition | null; photos: string[]; status: Status; created_at: string; sold_at: string | null };
export type Draft = { kind: Kind; title: string; description: string; price: string; category: Category; condition: Condition | ""; photos: string[] };
export const EMPTY_DRAFT: Draft = { kind: "sell", title: "", description: "", price: "", category: "Other", condition: "", photos: [] };

/** Dollars typed by a person ("25", "$25.50") to whole cents, or null when blank or not a price. */
export function parsePrice(text: string): number | null {
  const t = text.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}
/** "$25", "$25.50", "Free", or "Open to offers" when a wanted post names no budget. */
export function priceLabel(l: Pick<Listing, "kind" | "priceCents">): string {
  if (l.kind === "free") return "Free";
  if (l.priceCents === null) return l.kind === "wanted" ? "Open to offers" : "Ask";
  const d = l.priceCents / 100;
  return `$${Number.isInteger(d) ? d : d.toFixed(2)}`;
}
/** Plain words for what is wrong with a draft, or null if it can be posted. */
export function problemWithListing(d: Draft): string | null {
  const t = d.title.trim();
  if (t.length < 2) return "Give it a title.";
  if (t.length > 80) return "Keep the title under 80 characters.";
  if (d.description.length > 1000) return "Keep the description under 1000 characters.";
  if (d.kind === "sell") {
    const p = parsePrice(d.price);
    if (p === null) return "Enter a price, like 25 or 12.50. Choose Free if it costs nothing.";
    if (p > 1000000) return "That price is too high. The most is $10,000.";
  }
  if (d.kind === "wanted" && d.price.trim() && parsePrice(d.price) === null) return "Enter your budget as a number, or leave it empty.";
  return null;
}

export type Sort = "new" | "low" | "high";
export type Filters = { kind: Kind | "all"; category: Category | "all"; query: string; savedOnly: boolean; mineOnly: boolean; min: string; max: string; sort: Sort };
export const NO_FILTERS: Filters = { kind: "all", category: "all", query: "", savedOnly: false, mineOnly: false, min: "", max: "", sort: "new" };
/** What a listing costs in cents for sorting and the price filter: free is 0, and a listing with no price is unknown (null). */
export const priceOf = (l: Pick<Listing, "kind" | "priceCents">): number | null => (l.kind === "free" ? 0 : l.priceCents);
/** The listings to show, narrowed by what was asked and ordered (newest first unless told otherwise). Sold listings only show under "Mine".
 *  When a price range is set, listings with no price are left out rather than guessed. */
export function filterListings(list: Listing[], f: Filters): Listing[] {
  const q = f.query.trim().toLowerCase();
  const lo = parsePrice(f.min), hi = parsePrice(f.max);
  const newest = (a: Listing, b: Listing) => b.createdAt.localeCompare(a.createdAt);
  const cost = (l: Listing, empty: number) => priceOf(l) ?? empty;
  return list
    .filter((l) => (f.mineOnly ? l.mine : l.status === "active"))
    .filter((l) => f.kind === "all" || l.kind === f.kind)
    .filter((l) => f.category === "all" || l.category === f.category)
    .filter((l) => !f.savedOnly || l.saved)
    .filter((l) => !q || l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q))
    .filter((l) => { if (lo === null && hi === null) return true; const p = priceOf(l); return p !== null && (lo === null || p >= lo) && (hi === null || p <= hi); })
    .sort((a, b) => (f.sort === "low" ? cost(a, Infinity) - cost(b, Infinity) || newest(a, b) : f.sort === "high" ? cost(b, -1) - cost(a, -1) || newest(a, b) : newest(a, b)));
}
/** How many active listings there are in each category, for the list beside the grid. Respects the kind chosen, not the category. */
export function categoryCounts(list: Listing[], kind: Kind | "all"): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of list) if (l.status === "active" && (kind === "all" || l.kind === kind)) out[l.category] = (out[l.category] ?? 0) + 1;
  return out;
}
export const activeCount = (list: Listing[]) => list.filter((l) => l.mine && l.status === "active").length;

const toListing = (r: Row, me: string, saved: Set<string>): Listing => ({
  id: r.id, campusKey: r.campus_key, sellerId: r.seller_id, sellerName: r.seller_name, kind: r.kind, title: r.title, description: r.description, priceCents: r.price_cents,
  category: r.category, condition: r.condition, photos: r.photos ?? [], status: r.status, createdAt: r.created_at, soldAt: r.sold_at ?? undefined, mine: r.seller_id === me, saved: saved.has(r.id),
});

/* ---------- Demo mode ---------- */
const DKEY = "orbit-demo-listings-v1";
const SKEY = "orbit-demo-listing-saves-v1";
const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const seed = (campusKey: string): Row[] => [
  { id: "l1", campus_key: campusKey, seller_id: "u-priya", seller_name: "Priya", kind: "sell", title: "Calculus II textbook, 8th edition", description: "A few highlighted pages, no torn corners. Pickup near the student center.", price_cents: 2500, category: "Textbooks", condition: "Good", photos: [], status: "active", created_at: ago(5), sold_at: null },
  { id: "l2", campus_key: campusKey, seller_id: "u-alex", seller_name: "Alex", kind: "sell", title: "Mini fridge", description: "Works great, three years old. Fits under a loft bed.", price_cents: 6000, category: "Dorm and kitchen", condition: "Good", photos: [], status: "active", created_at: ago(9), sold_at: null },
  { id: "l3", campus_key: campusKey, seller_id: "u-skyler", seller_name: "Skyler", kind: "free", title: "Desk lamp and a small bookshelf", description: "Moving out. Come get them this week.", price_cents: null, category: "Furniture", condition: "Fair", photos: [], status: "active", created_at: ago(30), sold_at: null },
  { id: "l4", campus_key: campusKey, seller_id: "u-kai", seller_name: "Kai", kind: "sell", title: "21 speed bike with lock", description: "New tires. Great for getting across campus.", price_cents: 8500, category: "Bikes and rides", condition: "Like new", photos: [], status: "active", created_at: ago(52), sold_at: null },
  { id: "l5", campus_key: campusKey, seller_id: "u-noor", seller_name: "Noor", kind: "wanted", title: "Looking for a used scientific calculator", description: "TI-84 or similar, for the semester.", price_cents: 4000, category: "Electronics", condition: null, photos: [], status: "active", created_at: ago(70), sold_at: null },
];
function demoRows(campusKey: string): Row[] {
  try { const s = localStorage.getItem(DKEY); if (s) return JSON.parse(s) as Row[]; } catch { /* unavailable */ }
  return seed(campusKey);
}
const demoWrite = (rows: Row[]) => { try { localStorage.setItem(DKEY, JSON.stringify(rows)); } catch { /* ignore */ } };
const demoSaved = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(SKEY) ?? "[]") as string[]); } catch { return new Set(); } };
const demoSaveWrite = (s: Set<string>) => { try { localStorage.setItem(SKEY, JSON.stringify([...s])); } catch { /* ignore */ } };

const COLS = "id,campus_key,seller_id,seller_name,kind,title,description,price_cents,category,condition,photos,status,created_at,sold_at";

/** Everything the marketplace page needs, and the actions that change it. Changes show at once and the real list is fetched again after. */
export function useListings(me: string | undefined, campusKey: string | undefined, sellerName: string) {
  const [list, setList] = useState<Listing[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!me || !campusKey) return;
    if (!supabase) { const s = demoSaved(); setList(demoRows(campusKey).map((r) => toListing(r, me, s))); setReady(true); return; }
    const [rows, saves] = await Promise.all([
      supabase.from("campus_listings").select(COLS).order("created_at", { ascending: false }).limit(200),
      supabase.from("campus_listing_saves").select("listing_id").eq("user_id", me),
    ]);
    if (rows.error) { setError("Could not load listings. Pull to refresh or try again."); setReady(true); return; }
    const saved = new Set(((saves.data ?? []) as { listing_id: string }[]).map((s) => s.listing_id));
    setList((rows.data as Row[]).map((r) => toListing(r, me, saved)));
    setError(""); setReady(true);
  }, [me, campusKey]);
  useEffect(() => { void load(); }, [load]);

  const patch = (id: string, change: Partial<Listing>) => setList((l) => l.map((x) => (x.id === id ? { ...x, ...change } : x)));

  return {
    list, ready, error, reload: load,
    /** Post a listing. Resolves to a message to show if it did not work, or null. */
    async create(d: Draft): Promise<string | null> {
      if (!me || !campusKey) return "Pick your campus first.";
      if (activeCount(list) >= MAX_ACTIVE) return `You can have up to ${MAX_ACTIVE} active listings. Mark one as sold or take one down first.`;
      const row: Row = {
        id: crypto.randomUUID(), campus_key: campusKey, seller_id: me, seller_name: sellerName || "Student", kind: d.kind, title: d.title.trim(), description: d.description.trim(),
        price_cents: d.kind === "free" ? null : parsePrice(d.price), category: d.category, condition: d.kind === "wanted" || !d.condition ? null : d.condition, photos: d.photos.slice(0, 4), status: "active", created_at: new Date().toISOString(), sold_at: null,
      };
      if (!supabase) { demoWrite([row, ...demoRows(campusKey)]); await load(); return null; }
      const { error: e } = await supabase.from("campus_listings").insert(row);
      if (e) return /12 active/.test(e.message) ? e.message : "Could not post that. Try again.";
      await load(); return null;
    },
    async setStatus(id: string, status: Status): Promise<string | null> {
      const prev = list.find((l) => l.id === id); if (!prev || !campusKey) return null;
      patch(id, { status, soldAt: status === "sold" ? new Date().toISOString() : undefined });
      if (!supabase) { demoWrite(demoRows(campusKey).map((r) => (r.id === id ? { ...r, status, sold_at: status === "sold" ? new Date().toISOString() : null } : r))); return null; }
      const { error: e } = await supabase.from("campus_listings").update({ status, sold_at: status === "sold" ? new Date().toISOString() : null }).eq("id", id);
      if (e) { patch(id, { status: prev.status, soldAt: prev.soldAt }); return "Could not change that. Try again."; }
      return null;
    },
    async toggleSave(id: string): Promise<void> {
      const cur = list.find((l) => l.id === id); if (!cur || !me) return;
      patch(id, { saved: !cur.saved });
      if (!supabase) { const s = demoSaved(); if (cur.saved) s.delete(id); else s.add(id); demoSaveWrite(s); return; }
      const res = cur.saved ? await supabase.from("campus_listing_saves").delete().eq("user_id", me).eq("listing_id", id) : await supabase.from("campus_listing_saves").insert({ user_id: me, listing_id: id });
      if (res.error) patch(id, { saved: cur.saved });
    },
    async report(id: string, reason: string, detail: string): Promise<string | null> {
      if (!me) return "Sign in first.";
      if (!supabase) return null; // nothing to send in the demo
      const { error: e } = await supabase.from("campus_listing_reports").insert({ listing_id: id, reporter_id: me, reason, detail: detail.slice(0, 500) });
      if (e) return /duplicate|unique/i.test(e.message) ? "You already reported this listing. Thank you." : "Could not send the report. Try again.";
      return null;
    },
  };
}
