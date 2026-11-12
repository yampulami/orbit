import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { Bike, Bookmark, BookOpen, Check, Heart, ImagePlus, Laptop, Package, Plus, Search, ShieldAlert, Shirt, Sofa, Store, Ticket, User, UtensilsCrossed, Wrench, X, type LucideIcon } from "lucide-react";
import { useAuth } from "../lib/auth";
import { loadProfile } from "../lib/profile";
import { feedApi } from "../lib/feedData";
import { dmActions } from "../lib/dms";
import { useMediaUrl } from "../lib/media";
import {
  askAbout, CATEGORIES, parsePrice, CONDITIONS, EMPTY_DRAFT, KIND_LABEL, NO_FILTERS, activeCount, categoryCounts, filterListings, MAX_ACTIVE, priceLabel, problemWithListing, useListings,
  type Category, type Condition, type Draft, type Filters, type Kind, type Listing, type Sort,
} from "../lib/listings";
import { AttachPreview, useAttachment, type Attachment } from "./Attach";
import MediaImage from "./MediaImage";
import { notice } from "../lib/notice";

const REASONS = [["scam", "Looks like a scam"], ["prohibited", "Not allowed (weapons, drugs, alcohol and similar)"], ["spam", "Spam or not a real listing"], ["unsafe", "Feels unsafe"], ["other", "Something else"]] as const;
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

const CATEGORY_ICON: Record<Category, LucideIcon> = { Textbooks: BookOpen, Furniture: Sofa, Electronics: Laptop, Clothing: Shirt, "Dorm and kitchen": UtensilsCrossed, "Bikes and rides": Bike, Tickets: Ticket, Services: Wrench, Other: Package };

/** The marketplace for your campus, laid out like the ones people already know: a rail of ways to narrow things down (kind, category, price) beside a grid of
 *  photo cards with the price first. On a narrow screen the rail becomes a search box and a row of category chips. Orbit never handles money; the note says so. */
export default function Marketplace() {
  const { session } = useAuth();
  const me = session?.user.id;
  // The campus comes from the account (the same answer the feed uses), not from this device's saved answers, which a new browser does not have yet.
  const [campus, setCampus] = useState<{ key: string; name: string } | null | undefined>(undefined);
  useEffect(() => { let alive = true; void feedApi.campus().then((c) => { if (alive) setCampus(c ?? null); }).catch(() => { if (alive) setCampus(null); }); return () => { alive = false; }; }, [me]);
  const meta = session?.user.user_metadata as { name?: string } | undefined;
  const sellerName = (me ? loadProfile(me)?.name : "") || meta?.name || session?.user.email?.split("@")[0] || "";
  const { list, ready, error, create, setStatus, toggleSave, report } = useListings(me, campus?.key, sellerName);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [open, setOpen] = useState<Listing | null>(null);
  const [selling, setSelling] = useState(false);
  const shown = filterListings(list, filters);
  const counts = categoryCounts(list, filters.kind);
  const set = (f: Partial<Filters>) => setFilters((x) => ({ ...x, ...f }));
  const current = open ? list.find((l) => l.id === open.id) ?? null : null;
  const total = list.filter((l) => l.status === "active").length;
  const savedCount = list.filter((l) => l.saved && l.status === "active").length;
  const mineCount = list.filter((l) => l.mine).length;
  const view = filters.mineOnly ? "mine" : filters.savedOnly ? "saved" : "browse";
  const go = (v: "browse" | "saved" | "mine") => set({ mineOnly: v === "mine", savedOnly: v === "saved" });
  const heading = view === "mine" ? "Your listings" : view === "saved" ? "Saved" : filters.category !== "all" ? filters.category : filters.query.trim() ? `Results for \u201c${filters.query.trim()}\u201d` : "Today\u2019s picks";
  const reset = () => setFilters(NO_FILTERS);
  const narrowed = filters.kind !== "all" || filters.category !== "all" || !!filters.query.trim() || !!filters.min || !!filters.max;

  if (campus === undefined) return <div className="skeleton sk-card" aria-busy="true" />;
  if (campus === null) return <p className="rm-empty">Join your campus first and its marketplace will be here.</p>;
  return (
    <section className="mk" aria-label="Marketplace">
      <div className="mk-layout">
      <aside className="mk-rail" aria-label="Narrow the listings">
        <label className="mk-search"><Search size={18} aria-hidden="true" /><span className="sr">Search the marketplace</span>
          <input value={filters.query} onChange={(e) => set({ query: e.target.value })} placeholder="Search the marketplace" /></label>
        <button type="button" className="btn primary mk-new" onClick={() => setSelling(true)}><Plus size={18} aria-hidden="true" /><span className="mk-new-long">Create new listing</span><span className="mk-new-short">Sell</span></button>
        <nav className="mk-views" aria-label="Browse, saved or yours">
          <button type="button" aria-current={view === "browse"} onClick={() => go("browse")}><Store size={18} aria-hidden="true" />Browse all<small>{total}</small></button>
          <button type="button" aria-current={view === "saved"} onClick={() => go("saved")}><Bookmark size={18} aria-hidden="true" />Saved<small>{savedCount}</small></button>
          <button type="button" aria-current={view === "mine"} onClick={() => go("mine")}><User size={18} aria-hidden="true" />Your listings<small>{mineCount}</small></button>
        </nav>
        <div className="mk-group" role="group" aria-label="Kind">
          <h3>Kind</h3>
          {(["all", "sell", "free", "wanted"] as const).map((k) => <button key={k} type="button" aria-pressed={filters.kind === k} onClick={() => set({ kind: k })}>{k === "all" ? "Everything" : KIND_LABEL[k]}</button>)}
        </div>
        <div className="mk-group" role="group" aria-label="Category">
          <h3>Categories</h3>
          <button type="button" className="mk-cat" aria-pressed={filters.category === "all"} onClick={() => set({ category: "all" })}><Store size={18} aria-hidden="true" /><span>All categories</span></button>
          {CATEGORIES.map((c) => { const Icon = CATEGORY_ICON[c]; return <button key={c} type="button" className="mk-cat" aria-pressed={filters.category === c} disabled={!counts[c] && filters.category !== c} onClick={() => set({ category: c })}><Icon size={18} aria-hidden="true" /><span>{c}</span><small>{counts[c] ?? 0}</small></button>; })}
        </div>
        <div className="mk-group" role="group" aria-label="Price">
          <h3>Price</h3>
          <div className="mk-range">
            <label><span className="sr">Lowest price</span><input inputMode="decimal" placeholder="Min" value={filters.min} onChange={(e) => set({ min: e.target.value })} /></label>
            <span aria-hidden="true">to</span>
            <label><span className="sr">Highest price</span><input inputMode="decimal" placeholder="Max" value={filters.max} onChange={(e) => set({ max: e.target.value })} /></label>
          </div>
        </div>
        {narrowed && <button type="button" className="link-btn mk-clear" onClick={reset}>Clear filters</button>}
      </aside>

      <div className="mk-main">
        <div className="mk-phone" aria-hidden={false}>
          <div className="mk-chips" role="group" aria-label="Category">
            <button type="button" aria-pressed={filters.category === "all"} onClick={() => set({ category: "all" })}>All</button>
            {CATEGORIES.map((c) => <button key={c} type="button" aria-pressed={filters.category === c} onClick={() => set({ category: c })}>{c}</button>)}
          </div>
        </div>
        <header className="mk-bar">
          <div><h2>{heading}</h2><p className="mk-count">{shown.length} {shown.length === 1 ? "listing" : "listings"} at {campus.name}</p></div>
          <label className="mk-sort"><span className="sr">Sort by</span>
            <select value={filters.sort} onChange={(e) => set({ sort: e.target.value as Sort })}>
              <option value="new">Newest first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option>
            </select></label>
        </header>
        <p className="mk-note"><ShieldAlert size={14} aria-hidden="true" /> Orbit never handles money. Meet in a public place on campus, and check what you are buying before you hand anything over.</p>
        {error && <p className="error" role="alert">{error}</p>}
        {!ready ? <div className="skeleton sk-card" aria-busy="true" /> : shown.length === 0 ? (
          <div className="rm-empty">
            <p>{view === "mine" ? "You have not posted anything yet." : view === "saved" ? "Nothing saved yet. Tap the heart on a listing to keep it here." : narrowed ? "Nothing matches that." : "Nothing here yet."}</p>
            {narrowed ? <button type="button" className="btn" onClick={reset}>Clear filters</button> : <button type="button" className="btn primary" onClick={() => setSelling(true)}>Post the first one</button>}
          </div>
        ) : (
          <ul className="mk-grid">
            {shown.map((l) => <li key={l.id}><Card l={l} onOpen={() => setOpen(l)} onSave={() => void toggleSave(l.id)} /></li>)}
          </ul>
        )}
      </div>
      </div>
      {selling && createPortal(<NewListing active={activeCount(list)} onClose={() => setSelling(false)} onCreate={create} />, document.body)}
      {current && createPortal(<Detail l={current} onClose={() => setOpen(null)} onSave={() => void toggleSave(current.id)} onStatus={setStatus} onReport={report} />, document.body)}
    </section>
  );
}

function Cover({ path, alt, category }: { path?: string; alt: string; category: Category }) {
  const url = useMediaUrl(path ?? null);
  if (!path) { const Icon = CATEGORY_ICON[category]; return <span className="mk-cover none" aria-hidden="true"><Icon size={40} strokeWidth={1.4} /></span>; }
  return <span className="mk-cover">{url ? <img src={url} alt={alt} loading="lazy" decoding="async" draggable={false} /> : <span className="skeleton" aria-hidden="true" />}</span>;
}

/** One listing as a card: a square picture (or its category's icon), the price first, then the title and who and when. The heart saves it without opening it. */
function Card({ l, onOpen, onSave }: { l: Listing; onOpen: () => void; onSave: () => void }) {
  return (
    <div className={"mk-cardwrap" + (l.status !== "active" ? " off" : "")}>
      <button type="button" className="mk-card" onClick={onOpen} aria-label={`${l.title}, ${priceLabel(l)}${l.status === "sold" ? ", sold" : ""}`}>
        <Cover path={l.photos[0]} alt="" category={l.category} />
        <span className="mk-body">
          <span className="mk-price">{priceLabel(l)}{l.kind === "wanted" && <em>Wanted</em>}{l.status === "sold" && <em>Sold</em>}</span>
          <strong>{l.title}</strong>
          <span className="mk-meta">{l.sellerName} · {ago(l.createdAt)}</span>
        </span>
      </button>
      {!l.mine && <button type="button" className="mk-heart" aria-pressed={l.saved} aria-label={l.saved ? "Remove from saved" : "Save this listing"} onClick={onSave}><Heart size={18} fill={l.saved ? "currentColor" : "none"} aria-hidden="true" /></button>}
    </div>
  );
}

function Frame({ label, onClose, children, wide }: { label: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"modal mk-modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={label}>
        <div className="modal-top"><button type="button" className="round-btn" aria-label="Close" onClick={onClose} autoFocus><X size={20} aria-hidden="true" /></button></div>
        {children}
      </div>
    </div>
  );
}

function Detail({ l, onClose, onSave, onStatus, onReport }: { l: Listing; onClose: () => void; onSave: () => void; onStatus: (id: string, s: "active" | "sold" | "removed") => Promise<string | null>; onReport: (id: string, reason: string, detail: string) => Promise<string | null> }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string>("scam");
  const [detail, setDetail] = useState("");
  const [msg, setMsg] = useState("");
  const message = async () => { setBusy(true); const t = await dmActions.start(l.sellerId); setBusy(false); if (t) { onClose(); nav("/app/messages", { state: { thread: t, draft: askAbout(l) } }); } else setMsg("Could not open a conversation. Try again."); };
  const sendReport = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const p = await onReport(l.id, reason, detail); setBusy(false);
    if (p) setMsg(p); else { setReporting(false); notice.show({ icon: "alert", title: "Report sent", message: "Thank you. Whoever looks after Orbit will read it.", ms: 4000 }); }
  };
  const change = async (s: "active" | "sold" | "removed") => { setBusy(true); const p = await onStatus(l.id, s); setBusy(false); if (p) setMsg(p); else if (s === "removed") onClose(); };
  return (
    <Frame label={l.title} onClose={onClose}>
      {l.photos.length > 0 && <div className="mk-photos" data-n={l.photos.length}>{l.photos.map((p) => <MediaImage key={p} path={p} group={l.photos} />)}</div>}
      <div className="mk-head">
        <p className="mk-price big">{priceLabel(l)}<em>{KIND_LABEL[l.kind]}</em>{l.status === "sold" && <em>Sold</em>}</p>
        <h2>{l.title}</h2>
      </div>
      {l.description && <p className="mk-desc">{l.description}</p>}
      <dl className="mk-facts">
        <div><dt>Category</dt><dd>{l.category}</dd></div>
        {l.condition && <div><dt>Condition</dt><dd>{l.condition}</dd></div>}
        <div><dt>Posted</dt><dd>{ago(l.createdAt)}</dd></div>
      </dl>
      <div className="mk-who">
        <b aria-hidden="true">{(l.sellerName || "?").slice(0, 1).toUpperCase()}</b>
        <span>{l.kind === "wanted" ? "Asked by" : l.kind === "free" ? "Given by" : "Sold by"}{l.mine ? <strong>You</strong> : <Link to={`/app/people/${l.sellerId}`} onClick={onClose}>{l.sellerName}</Link>}</span>
      </div>
      {msg && <p className="error" role="alert">{msg}</p>}
      {reporting ? (
        <form className="mk-report" onSubmit={sendReport}>
          <label className="field">What is wrong with it?
            <select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          </label>
          <label className="field">Anything else we should know? (optional)<textarea rows={3} maxLength={500} value={detail} onChange={(e) => setDetail(e.target.value)} /></label>
          <div className="mk-actions"><button type="button" className="btn" onClick={() => setReporting(false)}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Sending…" : "Send report"}</button></div>
        </form>
      ) : l.mine ? (
        <div className="mk-actions">
          {l.status === "active" ? <button type="button" className="btn primary" disabled={busy} onClick={() => void change("sold")}><Check size={18} aria-hidden="true" />Mark as {l.kind === "wanted" ? "found" : l.kind === "free" ? "given away" : "sold"}</button> : <button type="button" className="btn" disabled={busy} onClick={() => void change("active")}>Put it back up</button>}
          <button type="button" className="btn" disabled={busy} onClick={() => void change("removed")}>Take down</button>
        </div>
      ) : (
        <div className="mk-actions">
          <button type="button" className="btn primary" disabled={busy || l.status !== "active"} onClick={() => void message()}>{l.kind === "wanted" ? "I have this" : l.kind === "free" ? "Ask for it" : "Message seller"}</button>
          <button type="button" className="btn" aria-pressed={l.saved} onClick={onSave}><Bookmark size={18} fill={l.saved ? "currentColor" : "none"} aria-hidden="true" />{l.saved ? "Saved" : "Save"}</button>
          <button type="button" className="link-btn" onClick={() => setReporting(true)}>Report</button>
        </div>
      )}
    </Frame>
  );
}

function NewListing({ active, onClose, onCreate }: { active: number; onClose: () => void; onCreate: (d: Draft) => Promise<string | null> }) {
  const [d, setD] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const att = useAttachment(4);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const draft = { ...d, photos: att.items.map((i) => i.path) };
    const problem = problemWithListing(draft);
    if (problem) { setError(problem); return; }
    setBusy(true); setError("");
    const p = await onCreate(draft);
    setBusy(false);
    if (p) { setError(p); return; }
    att.clear();
    notice.show({ icon: "pin", title: "Posted", message: "It is on your campus marketplace now.", ms: 3500 });
    onClose();
  };
  const close = () => { att.drop(); onClose(); };
  const Icon = CATEGORY_ICON[d.category];
  const money = d.kind === "free" ? null : parsePrice(d.price);
  return (
    <Frame label="New listing" onClose={close} wide>
      <form className="mk-form" onSubmit={submit}>
        <div className="mk-fields">
          <header className="mk-formhead">
            <h2>New listing</h2>
            <p className="muted">Tell people what it is. A clear photo and a fair price get the fastest replies.</p>
          </header>
          <div className="mk-seg" role="radiogroup" aria-label="What are you doing?">
            {(["sell", "free", "wanted"] as Kind[]).map((k) => <button key={k} type="button" role="radio" aria-checked={d.kind === k} onClick={() => set({ kind: k })}>{k === "sell" ? "Selling" : k === "free" ? "Giving away" : "Looking for"}</button>)}
          </div>
          <PhotoField a={att} />
          <label className="field">Title<input value={d.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} placeholder={d.kind === "wanted" ? "What are you looking for?" : "What is it?"} autoFocus /></label>
          {d.kind !== "free" && <label className="field">{d.kind === "wanted" ? "Your budget (optional)" : "Price"}<span className="mk-money"><span aria-hidden="true">$</span><input inputMode="decimal" value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder={d.kind === "wanted" ? "Leave empty if open to offers" : "25"} /></span></label>}
          <div className="field" role="radiogroup" aria-label="Category">
            <span className="mk-label">Category</span>
            <div className="mk-chipgrid">
              {CATEGORIES.map((c) => { const I = CATEGORY_ICON[c]; return <button key={c} type="button" role="radio" aria-checked={d.category === c} onClick={() => set({ category: c })}><I size={16} aria-hidden="true" />{c}</button>; })}
            </div>
          </div>
          {d.kind !== "wanted" && (
            <div className="field" role="radiogroup" aria-label="Condition">
              <span className="mk-label">Condition <span className="muted">(optional)</span></span>
              <div className="mk-seg tight">
                {CONDITIONS.map((c) => <button key={c} type="button" role="radio" aria-checked={d.condition === c} onClick={() => set({ condition: d.condition === c ? "" : c })}>{c}</button>)}
              </div>
            </div>
          )}
          <label className="field"><span>Description <span className="muted">(optional)</span></span>
            <textarea rows={3} maxLength={1000} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Size, age, where you can meet" />
            <small className="mk-count-in">{d.description.length} / 1000</small>
          </label>
        </div>

        <aside className="mk-preview" aria-label="How your listing will look">
          <span className="mk-label">How it will look</span>
          <div className="mk-card static">
            {att.items[0] ? <span className="mk-cover"><img src={att.items[0].preview} alt="" /></span> : <span className="mk-cover none"><Icon size={40} strokeWidth={1.4} aria-hidden="true" /></span>}
            <span className="mk-body">
              <span className="mk-price">{d.kind === "sell" && money === null ? "Price" : priceLabel({ kind: d.kind, priceCents: money })}{d.kind === "wanted" && <em>Wanted</em>}</span>
              <strong>{d.title.trim() || "Your title"}</strong>
              <span className="mk-meta">You · just now</span>
            </span>
          </div>
          <p className="mk-note"><ShieldAlert size={14} aria-hidden="true" /> Orbit never handles money. Do not list weapons, drugs, alcohol or anything illegal.</p>
        </aside>

        <div className="mk-foot">
          <span className="muted">{active} of {MAX_ACTIVE} active listings</span>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary" disabled={busy || att.busy}>{busy ? "Posting…" : "Post listing"}</button>
        </div>
      </form>
    </Frame>
  );
}

/** Photos for a listing: four square slots, the first one is the cover. Listings with photos get far more attention. */
function PhotoField({ a }: { a: Attachment }) {
  const empties = Math.max(0, a.max - a.items.length - (a.full ? 0 : 1));
  return (
    <div className="field mk-photo-field">
      <span className="mk-label" id="mk-photos-l">Photos <span className="muted">(optional, up to {a.max})</span></span>
      <div className="mk-slots">
        {a.items.map((it, n) => (
          <span className="mk-slot" key={it.path}>
            <img src={it.preview} alt={`Photo ${n + 1}`} />
            {n === 0 && <em>Cover</em>}
            <button type="button" className="attach-x" aria-label={`Remove photo ${n + 1}`} onClick={() => a.remove(it.path)}><X size={14} aria-hidden="true" /></button>
          </span>
        ))}
        {!a.full && (
          <label className="mk-slot add">
            <ImagePlus size={22} aria-hidden="true" />
            <span>{a.busy ? "Adding…" : a.items.length === 0 ? "Add photos" : "Add more"}</span>
            <input type="file" accept="image/*" multiple className="sr" aria-labelledby="mk-photos-l" disabled={a.busy}
              onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) void a.pick(f); }} />
          </label>
        )}
        {Array.from({ length: empties }, (_, n) => <span className="mk-slot blank" key={n} aria-hidden="true" />)}
      </div>
      {a.error && <span className="error" role="alert">{a.error}</span>}
    </div>
  );
}
