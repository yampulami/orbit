import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, GraduationCap, X } from "lucide-react";
import Avatar from "../components/Avatar";
import PersonLink from "../components/PersonLink";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../lib/auth";
import { OPEN_LABEL, OPEN_TO, useAlumni, type Alum, type AlumFields, type OpenTo } from "../lib/alumni";
import { useBackupEmail } from "../lib/backupEmail";
import { notice } from "../lib/notice";

type Tab = "directory" | "requests" | "me";
const THIS_YEAR = new Date().getFullYear();

/** Alumni: graduates who chose to stay reachable. Students look for people at a company or in a field and ask for an introduction; the graduate decides.
 *  Nobody's email is shown. The conversation goes through Orbit. */
export default function Alumni() {
  const { session } = useAuth();
  const me = session?.user.id;
  const { list, mine, reqs, ready, saveMine, removeMine, ask, answer } = useAlumni(me);
  const { email: personal } = useBackupEmail(me);
  const [tab, setTab] = useState<Tab>("directory");
  const waiting = reqs.filter((r) => r.incoming && r.status === "pending").length;
  const tabs: [Tab, string][] = [["directory", "Directory"], ["requests", waiting ? `Requests ${waiting}` : "Requests"], ["me", mine ? "My listing" : "List yourself"]];

  return (
    <div className="page alumni">
      <h1 className="al-title"><GraduationCap size={26} aria-hidden="true" /> Alumni</h1>
      <p className="muted al-intro">Graduates who stayed reachable. Find someone at a company or in a field, and ask for an introduction. They decide whether to answer, and your email stays private.</p>
      <div className="segment" role="tablist" aria-label="Alumni">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === "directory" && <Directory list={list} ready={ready} ask={ask} />}
      {tab === "requests" && <Requests reqs={reqs} answer={answer} />}
      {tab === "me" && <MyListing mine={mine} save={saveMine} remove={removeMine} hasPersonal={!!personal} />}
    </div>
  );
}

function Directory({ list, ready, ask }: { list: Alum[]; ready: boolean; ask: (id: string, note: string) => Promise<string | null> }) {
  const [q, setQ] = useState("");
  const [want, setWant] = useState<OpenTo | "">("");
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list.filter((a) => (!want || a.openTo.includes(want)) && (!t || [a.name, a.company, a.jobTitle, a.industry, a.field, String(a.gradYear)].some((x) => x.toLowerCase().includes(t))));
  }, [list, q, want]);

  return (
    <section aria-label="Directory">
      <div className="al-tools">
        <input className="al-search" type="search" aria-label="Search by name, company, field or year" placeholder="Search a company, field or name" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="al-chips" role="group" aria-label="Open to">
          {OPEN_TO.map((o) => <button key={o} type="button" className="chip-btn" aria-pressed={want === o} onClick={() => setWant(want === o ? "" : o)}>{OPEN_LABEL[o]}</button>)}
        </div>
      </div>
      {!ready ? <div className="skeleton sk-card" aria-busy="true" aria-label="Loading alumni" />
        : shown.length === 0 ? <EmptyState icon={GraduationCap} title={list.length === 0 ? "No graduates listed yet" : "No one matches that"}>{list.length === 0 ? "When graduates list themselves, you can find them here." : "Try a different company or clear the filter."}</EmptyState>
        : <ul className="al-list">{shown.map((a) => (
          <li key={a.id} className="al-card">
            <PersonLink id={a.id} className="cf-avlink" decorative><Avatar name={a.name} id={a.id} size={44} /></PersonLink>
            <div className="al-main">
              <p className="al-name"><PersonLink id={a.id} className="who-link"><strong>{a.name}</strong></PersonLink><span className="muted"> Class of {a.gradYear}</span></p>
              <p className="al-job">{[a.jobTitle, a.company].filter(Boolean).join(" at ") || a.field || "Graduate"}{a.industry ? <span className="muted"> · {a.industry}</span> : null}</p>
              {a.field && (a.jobTitle || a.company) && <p className="muted al-sub">Studied {a.field}</p>}
              {a.about && <p className="al-about">{a.about}</p>}
              {a.openTo.length > 0 && <p className="al-open">{a.openTo.map((o) => <span key={o} className="ebadge student">{OPEN_LABEL[o]}</span>)}</p>}
              {open === a.id
                ? <AskForm name={a.name} onCancel={() => setOpen(null)} onSend={async (note) => { const p = await ask(a.id, note); if (!p) { setOpen(null); notice.show({ icon: "wifi", title: "Request sent", message: `${a.name} will see your note and can answer when they are ready.`, ms: 5000 }); } return p; }} />
                : <button type="button" className="btn sm" onClick={() => setOpen(a.id)}>Ask for an introduction</button>}
            </div>
          </li>
        ))}</ul>}
    </section>
  );
}

function AskForm({ name, onSend, onCancel }: { name: string; onSend: (note: string) => Promise<string | null>; onCancel: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) { setError("Write a line about what you are asking for."); return; }
    setBusy(true); setError("");
    const p = await onSend(note);
    setBusy(false);
    if (p) setError(p);
  }
  return (
    <form className="al-ask" onSubmit={submit}>
      <label>What would you like to ask {name}?
        <textarea autoFocus rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: I am graduating in May and applying to your company. Could you refer me?" />
      </label>
      <span className="count">{note.length}/300</span>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="al-actions"><button className="btn sm primary" disabled={busy}>{busy ? "Sending…" : "Send request"}</button><button type="button" className="btn sm" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function Requests({ reqs, answer }: { reqs: ReturnType<typeof useAlumni>["reqs"]; answer: (id: string, accept: boolean) => Promise<string | null> }) {
  const incoming = reqs.filter((r) => r.incoming);
  const sent = reqs.filter((r) => !r.incoming);
  const ago = (iso: string) => { const d = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)); return d < 1 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };
  const respond = async (id: string, yes: boolean) => { const p = await answer(id, yes); if (p) notice.show({ icon: "wifi", title: "That did not work", message: p }); };
  return (
    <section aria-label="Requests">
      <h2 className="al-h">Asked of you</h2>
      {incoming.length === 0 ? <p className="muted">Nothing yet. Requests from students show up here, and in your notifications.</p>
        : <ul className="al-list">{incoming.map((r) => (
          <li key={r.id} className="al-card">
            <PersonLink id={r.otherId} className="cf-avlink" decorative><Avatar name={r.other} id={r.otherId} size={40} /></PersonLink>
            <div className="al-main">
              <p className="al-name"><PersonLink id={r.otherId} className="who-link"><strong>{r.other}</strong></PersonLink><span className="muted"> {ago(r.at)}</span></p>
              <p className="al-about">{r.note}</p>
              {r.status === "pending"
                ? <div className="al-actions"><button type="button" className="btn sm primary" onClick={() => void respond(r.id, true)}><Check size={14} aria-hidden="true" /> Accept</button><button type="button" className="btn sm" onClick={() => void respond(r.id, false)}><X size={14} aria-hidden="true" /> Decline</button></div>
                : <p className="muted">{r.status === "accepted" ? "You accepted. They can message you now." : "You declined."}</p>}
            </div>
          </li>
        ))}</ul>}
      <h2 className="al-h">Your requests</h2>
      {sent.length === 0 ? <p className="muted">You have not asked anyone yet. Find someone in the directory.</p>
        : <ul className="al-list">{sent.map((r) => (
          <li key={r.id} className="al-card">
            <PersonLink id={r.otherId} className="cf-avlink" decorative><Avatar name={r.other} id={r.otherId} size={40} /></PersonLink>
            <div className="al-main">
              <p className="al-name"><PersonLink id={r.otherId} className="who-link"><strong>{r.other}</strong></PersonLink><span className="muted"> {ago(r.at)}</span></p>
              <p className="al-about">{r.note}</p>
              <p className="muted">{r.status === "pending" ? "Waiting for an answer." : r.status === "accepted" ? "Accepted. You can message them from their profile." : "Not this time."}</p>
            </div>
          </li>
        ))}</ul>}
    </section>
  );
}

function MyListing({ mine, save, remove, hasPersonal }: { mine: AlumFields | null; save: (f: AlumFields) => Promise<string | null>; remove: () => Promise<string | null>; hasPersonal: boolean }) {
  const [f, setF] = useState<AlumFields>(mine ?? { gradYear: THIS_YEAR, field: "", company: "", jobTitle: "", industry: "", about: "", openTo: [], listed: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof AlumFields>(k: K, v: AlumFields[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (o: OpenTo) => set("openTo", f.openTo.includes(o) ? f.openTo.filter((x) => x !== o) : [...f.openTo, o]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const p = await save(f);
    setBusy(false);
    if (p) { setError(p); return; }
    notice.show({ icon: "wifi", title: mine ? "Listing updated" : "You are listed", message: f.listed ? "Students can find you and ask for an introduction." : "Saved. You are hidden from the directory.", ms: 4500 });
  }
  return (
    <section aria-label="My alumni listing">
      {!hasPersonal && (
        <p className="al-warn" role="note">Graduating? Your school email will stop working. <Link to="/app/profile?tab=settings">Add a personal email</Link> so you can still sign in and get these requests.</p>
      )}
      <form className="al-form" onSubmit={submit}>
        <label>Year you graduate or graduated
          <input type="number" required min={1990} max={2100} inputMode="numeric" value={f.gradYear || ""} onChange={(e) => set("gradYear", Number(e.target.value))} />
        </label>
        <label>What you studied <span className="muted">(optional)</span>
          <input maxLength={80} value={f.field} onChange={(e) => set("field", e.target.value)} placeholder="Computer Science" />
        </label>
        <label>Company <span className="muted">(optional)</span>
          <input maxLength={80} value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Where you work, or are going to" />
        </label>
        <label>Job title <span className="muted">(optional)</span>
          <input maxLength={80} value={f.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
        </label>
        <label>Industry <span className="muted">(optional)</span>
          <input maxLength={60} value={f.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Technology, healthcare, finance" />
        </label>
        <label>A line for students <span className="muted">(optional)</span>
          <textarea rows={3} maxLength={300} value={f.about} onChange={(e) => set("about", e.target.value)} placeholder="What you are happy to help with" />
        </label>
        <fieldset className="al-open-to">
          <legend>I am open to</legend>
          {OPEN_TO.map((o) => <button key={o} type="button" className="chip-btn" aria-pressed={f.openTo.includes(o)} onClick={() => toggle(o)}>{OPEN_LABEL[o]}</button>)}
        </fieldset>
        <div className="notif-row">
          <span id="al-listed">Show me in the directory</span>
          <button type="button" role="switch" aria-checked={f.listed} aria-labelledby="al-listed" className="switch" onClick={() => set("listed", !f.listed)}><span /></button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="al-actions">
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : mine ? "Save changes" : "List me"}</button>
          {mine && <button type="button" className="link-btn" onClick={async () => { const p = await remove(); if (!p) notice.show({ icon: "wifi", title: "You are no longer listed", message: "Your listing was removed.", ms: 4000 }); }}>Remove my listing</button>}
        </div>
      </form>
    </section>
  );
}
