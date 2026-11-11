import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { Bookmark, Check, Plus, Search, ShieldAlert, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { loadProfile } from "../lib/profile";
import { feedApi } from "../lib/feedData";
import { dmActions } from "../lib/dms";
import { useMediaUrl } from "../lib/media";
import {
  CATEGORIES, CONDITIONS, EMPTY_DRAFT, KIND_LABEL, NO_FILTERS, activeCount, filterListings, MAX_ACTIVE, priceLabel, problemWithListing, useListings,
  type Category, type Condition, type Draft, type Filters, type Kind, type Listing,
} from "../lib/listings";
import { AttachButton, AttachPreview, useAttachment } from "./Attach";
import MediaImage from "./MediaImage";
import { notice } from "../lib/notice";

const REASONS = [["scam", "Looks like a scam"], ["prohibited", "Not allowed (weapons, drugs, alcohol and similar)"], ["spam", "Spam or not a real listing"], ["unsafe", "Feels unsafe"], ["other", "Something else"]] as const;
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

/** The marketplace for your campus: things to buy, to take for free, and things students are looking for. Orbit never handles money; the safety note says so. */
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
  const set = (f: Partial<Filters>) => setFilters((x) => ({ ...x, ...f }));
  const current = open ? list.find((l) => l.id === open.id) ?? null : null;

  if (campus === undefined) return <div className="skeleton sk-card" aria-busy="true" />;
  if (campus === null) return <p className="rm-empty">Join your campus first and its marketplace will be here.</p>;
  return (
    <section className="mk" aria-label="Marketplace">
      <div className="mk-top">
        <label className="mk-search"><Search size={18} aria-hidden="true" /><span className="sr">Search the marketplace</span>
          <input value={filters.query} onChange={(e) => set({ query: e.target.value })} placeholder="Search listings" /></label>
        <button type="button" className="btn primary" onClick={() => setSelling(true)}><Plus size={18} aria-hidden="true" />Sell or ask</button>
      </div>
      <div className="mk-filters">
        <div className="segment" role="group" aria-label="Kind">
          {(["all", "sell", "free", "wanted"] as const).map((k) => <button key={k} type="button" aria-pressed={!filters.mineOnly && filters.kind === k} onClick={() => set({ kind: k, mineOnly: false })}>{k === "all" ? "All" : KIND_LABEL[k]}</button>)}
        </div>
        <select aria-label="Category" value={filters.category} onChange={(e) => set({ category: e.target.value as Category | "all" })}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" className="chip-btn" aria-pressed={filters.savedOnly} onClick={() => set({ savedOnly: !filters.savedOnly })}><Bookmark size={14} aria-hidden="true" />Saved</button>
        <button type="button" className="chip-btn" aria-pressed={filters.mineOnly} onClick={() => set({ mineOnly: !filters.mineOnly })}>Mine</button>
      </div>
      <p className="mk-note"><ShieldAlert size={14} aria-hidden="true" /> Orbit never handles money. Meet in a public place on campus, and check what you are buying before you hand anything over.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {!ready ? <div className="skeleton sk-card" aria-busy="true" /> : shown.length === 0 ? (
        <div className="rm-empty">
          <p>{filters.mineOnly ? "You have not posted anything yet." : filters.savedOnly ? "Nothing saved yet." : filters.query || filters.kind !== "all" || filters.category !== "all" ? "Nothing matches that." : "Nothing here yet."}</p>
          <button type="button" className="btn primary" onClick={() => setSelling(true)}>Post the first one</button>
        </div>
      ) : (
        <ul className="mk-grid">
          {shown.map((l) => <li key={l.id}><Card l={l} onOpen={() => setOpen(l)} /></li>)}
        </ul>
      )}
      {selling && createPortal(<NewListing active={activeCount(list)} onClose={() => setSelling(false)} onCreate={create} />, document.body)}
      {current && createPortal(<Detail l={current} onClose={() => setOpen(null)} onSave={() => void toggleSave(current.id)} onStatus={setStatus} onReport={report} />, document.body)}
    </section>
  );
}

function Cover({ path, alt }: { path?: string; alt: string }) {
  const url = useMediaUrl(path ?? null);
  if (!path) return <span className="mk-cover none" aria-hidden="true" />;
  return <span className="mk-cover">{url ? <img src={url} alt={alt} loading="lazy" decoding="async" draggable={false} /> : <span className="skeleton" aria-hidden="true" />}</span>;
}

function Card({ l, onOpen }: { l: Listing; onOpen: () => void }) {
  return (
    <button type="button" className={"mk-card" + (l.status !== "active" ? " off" : "")} onClick={onOpen} aria-label={`${l.title}, ${priceLabel(l)}${l.status === "sold" ? ", sold" : ""}`}>
      <Cover path={l.photos[0]} alt="" />
      <span className="mk-body">
        <span className="mk-price">{priceLabel(l)}{l.kind === "wanted" && <em>Wanted</em>}{l.status === "sold" && <em>Sold</em>}</span>
        <strong>{l.title}</strong>
        <span className="mk-meta">{l.category} · {l.sellerName} · {ago(l.createdAt)}</span>
      </span>
      {l.saved && <Bookmark className="mk-saved" size={16} fill="currentColor" aria-label="Saved" />}
    </button>
  );
}

function Frame({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal mk-modal" role="dialog" aria-modal="true" aria-label={label}>
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
  const message = async () => { setBusy(true); const t = await dmActions.start(l.sellerId); setBusy(false); if (t) { onClose(); nav("/app/messages", { state: { thread: t } }); } else setMsg("Could not open a conversation. Try again."); };
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
        <p className="mk-meta">{l.category}{l.condition ? ` · ${l.condition}` : ""} · {ago(l.createdAt)}</p>
      </div>
      {l.description && <p className="mk-desc">{l.description}</p>}
      <p className="mk-seller">{l.kind === "wanted" ? "Asked by" : "Sold by"} {l.mine ? "you" : <Link to={`/app/people/${l.sellerId}`} onClick={onClose}>{l.sellerName}</Link>}</p>
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
  return (
    <Frame label="New listing" onClose={close}>
      <form className="mk-form" onSubmit={submit}>
        <h2>Sell, give away or ask</h2>
        <div className="segment" role="radiogroup" aria-label="What are you doing?">
          {(["sell", "free", "wanted"] as Kind[]).map((k) => <button key={k} type="button" role="radio" aria-checked={d.kind === k} onClick={() => set({ kind: k })}>{k === "sell" ? "Selling" : k === "free" ? "Giving away" : "Looking for"}</button>)}
        </div>
        <label className="field">Title<input value={d.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} placeholder={d.kind === "wanted" ? "What are you looking for?" : "What is it?"} autoFocus /></label>
        {d.kind !== "free" && <label className="field">{d.kind === "wanted" ? "Your budget (optional)" : "Price"}<span className="mk-money"><span aria-hidden="true">$</span><input inputMode="decimal" value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder={d.kind === "wanted" ? "Leave empty if open to offers" : "25"} /></span></label>}
        <div className="mk-two">
          <label className="field">Category<select value={d.category} onChange={(e) => set({ category: e.target.value as Category })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          {d.kind !== "wanted" && <label className="field">Condition<select value={d.condition} onChange={(e) => set({ condition: e.target.value as Condition | "" })}><option value="">Not sure</option>{CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>}
        </div>
        <label className="field">Description (optional)<textarea rows={4} maxLength={1000} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Size, age, where you can meet" /></label>
        <AttachPreview a={att} />
        <div className="mk-foot">
          <AttachButton a={att} />
          <span className="muted">{active} of {MAX_ACTIVE} active listings</span>
          <button className="btn primary" disabled={busy || att.busy}>{busy ? "Posting…" : "Post"}</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="mk-note">Orbit never handles money. Do not list weapons, drugs, alcohol or anything illegal.</p>
      </form>
    </Frame>
  );
}
