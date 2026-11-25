import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { dmActions } from "../lib/dms";
import { useCampusOrgs } from "../lib/campusOrgs";
import { clubChoices, clubsByPerson } from "../lib/alumniClubs";
import { Check, GraduationCap, MessageSquare, X } from "lucide-react";
import Avatar from "../components/Avatar";
import PersonLink from "../components/PersonLink";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../lib/auth";
import { OPEN_LABEL, OPEN_TO, useAlumni, type Alum, type AlumFields, type OpenTo } from "../lib/alumni";
import { GraduationPanel } from "../components/Graduation";
import AlumBadge from "../components/AlumBadge";
import { useGraduation } from "../lib/graduation";
import { notice } from "../lib/notice";

type Tab = "directory" | "requests" | "me";

/** Alumni: graduates who chose to stay reachable. Students look for people at a company or in a field and ask for an introduction; the graduate decides.
 *  Nobody's email is shown. The conversation goes through Orbit. */
export default function Alumni() {
  const { session } = useAuth();
  const me = session?.user.id;
  const { list, mine, reqs, ready, saveMine, removeMine, ask, answer } = useAlumni(me);
  const { grad } = useGraduation(me);
  const verified = grad?.status === "verified";
  const [tab, setTab] = useState<Tab>("directory");
  const waiting = reqs.filter((r) => r.incoming && r.status === "pending").length;
  // only a verified graduate has a listing, and only they get asked; everyone else sees what they sent
  const tabs: [Tab, string][] = [["directory", "Directory"], ["requests", waiting ? `Requests ${waiting}` : "Requests"], ...(verified ? [["me", mine ? "My listing" : "List yourself"] as [Tab, string]] : [])];

  return (
    <div className="page alumni">
      <h1 className="sr">Alumni</h1>
      <p className="muted al-intro">Graduates who stayed reachable, each confirmed by a coordinator. Find someone at a company or in a field and ask for an introduction. They decide whether to answer, and your email stays private.</p>
      {me && <GraduationPanel userId={me} />}
      <div className="segment" role="tablist" aria-label="Alumni">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === "directory" && <Directory list={list} ready={ready} ask={ask} />}
      {tab === "requests" && <Requests reqs={reqs} answer={answer} />}
      {tab === "me" && verified && <MyListing mine={mine} year={grad.year} save={saveMine} remove={removeMine} />}
    </div>
  );
}

function Directory({ list, ready, ask }: { list: Alum[]; ready: boolean; ask: (id: string, note: string) => Promise<string | null> }) {
  const [q, setQ] = useState("");
  const [want, setWant] = useState<OpenTo | "">("");
  // the club filter lives in the address, so a club page can link straight to its own graduates
  const [params, setParams] = useSearchParams();
  const club = params.get("club") ?? "";
  const setClub = (id: string) => setParams(id ? { club: id } : {}, { replace: true });
  const { orgs } = useCampusOrgs();
  const byPerson = useMemo(() => clubsByPerson(orgs), [orgs]);
  const choices = useMemo(() => clubChoices(list.map((a) => a.id), byPerson), [list, byPerson]);
  const picked = orgs.find((o) => o.id === club);
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list.filter((a) => (!want || a.openTo.includes(want)) && (!club || (byPerson.get(a.id) ?? []).some((c) => c.id === club))
      && (!t || [a.name, a.company, a.jobTitle, a.industry, a.field, String(a.gradYear), ...(byPerson.get(a.id) ?? []).map((c) => c.name)].some((x) => x.toLowerCase().includes(t))));
  }, [list, q, want, club, byPerson]);

  return (
    <section aria-label="Directory">
      <div className="al-tools">
        <input className="al-search" type="search" aria-label="Search by name, company, field, club or year" placeholder="Search a company, field, club or name" value={q} onChange={(e) => setQ(e.target.value)} />
        {(choices.length > 0 || club) && (
          <label className="al-club">Club or community
            <select value={club} onChange={(e) => setClub(e.target.value)}>
              <option value="">Any club</option>
              {club && !choices.some((c) => c.id === club) && <option value={club}>{picked?.name ?? "That club"} (none listed)</option>}
              {choices.some((c) => c.mine) && <optgroup label="Your clubs">{choices.filter((c) => c.mine).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}</optgroup>}
              {choices.some((c) => !c.mine) && <optgroup label={choices.some((c) => c.mine) ? "Other clubs" : "Clubs"}>{choices.filter((c) => !c.mine).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}</optgroup>}
            </select>
          </label>
        )}
        <div className="al-chips" role="group" aria-label="Open to">
          {OPEN_TO.map((o) => <button key={o} type="button" className="chip-btn" aria-pressed={want === o} onClick={() => setWant(want === o ? "" : o)}>{OPEN_LABEL[o]}</button>)}
        </div>
      </div>
      {!ready ? <div className="skeleton sk-card" aria-busy="true" aria-label="Loading alumni" />
        : shown.length === 0 ? <EmptyState icon={GraduationCap} title={list.length === 0 ? "No graduates listed yet" : club && !q && !want ? `No graduates from ${picked?.name ?? "that club"} yet` : "No one matches that"}>{list.length === 0 ? "When graduates list themselves, you can find them here." : club ? "Choose Any club to see everyone." : "Try a different company or clear the filter."}</EmptyState>
        : <ul className="al-list">{shown.map((a) => (
          <li key={a.id} className="al-card">
            <PersonLink id={a.id} className="cf-avlink" decorative><Avatar name={a.name} id={a.id} size={44} /></PersonLink>
            <div className="al-main">
              <p className="al-name"><PersonLink id={a.id} className="who-link"><strong>{a.name}</strong></PersonLink><AlumBadge id={a.id} /></p>
              <p className="al-job">{[a.jobTitle, a.company].filter(Boolean).join(" at ") || a.field || "Graduate"}{a.industry ? <span className="muted"> · {a.industry}</span> : null}</p>
              {a.field && (a.jobTitle || a.company) && <p className="muted al-sub">Studied {a.field}</p>}
              {a.about && <p className="al-about">{a.about}</p>}
              {(byPerson.get(a.id) ?? []).length > 0 && <p className="al-clubs">{(byPerson.get(a.id) ?? []).slice(0, 3).map((c) => <Link key={c.id} to={`/app/campus/clubs/${c.id}`} data-mine={c.mine || undefined}>{c.name}{c.mine ? " · your club" : ""}</Link>)}</p>}
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

/** Opens the conversation with the other person (accepting a request made it a normal chat). */
function MessageButton({ id, name }: { id: string; name: string }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    const thread = await dmActions.start(id);
    setBusy(false);
    if (thread) nav("/app/messages", { state: { thread } });
    else notice.show({ icon: "wifi", title: "Could not open the chat", message: "Check your connection and try again." });
  };
  return <button type="button" className="btn sm primary" disabled={busy} onClick={() => void open()} aria-label={`Message ${name}`}><MessageSquare size={14} aria-hidden="true" /> {busy ? "Opening…" : "Message"}</button>;
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
                : r.status === "accepted" ? <><p className="muted">You accepted.</p><MessageButton id={r.otherId} name={r.other} /></> : <p className="muted">You declined.</p>}
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
              <p className="muted">{r.status === "pending" ? "Waiting for an answer." : r.status === "accepted" ? "Accepted." : "Not this time."}</p>
              {r.status === "accepted" && <MessageButton id={r.otherId} name={r.other} />}
            </div>
          </li>
        ))}</ul>}
    </section>
  );
}

function MyListing({ mine, year, save, remove }: { mine: AlumFields | null; year: number; save: (f: AlumFields) => Promise<string | null>; remove: () => Promise<string | null> }) {
  const [f, setF] = useState<AlumFields>(mine ?? { gradYear: year, field: "", company: "", jobTitle: "", industry: "", about: "", openTo: [], listed: true });
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
      <form className="al-form" onSubmit={submit}>
        <p className="muted">Class of {year}, confirmed by a coordinator.</p>
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
