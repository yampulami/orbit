import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, GraduationCap, MessageSquare, Search, X } from "lucide-react";
import Avatar from "../components/Avatar";
import PersonLink from "../components/PersonLink";
import EmptyState from "../components/EmptyState";
import AlumBadge from "../components/AlumBadge";
import AlumniCard from "../components/AlumniCard";
import AlumniAsk from "../components/AlumniAsk";
import { GraduationPanel } from "../components/Graduation";
import { useAuth } from "../lib/auth";
import { dmActions } from "../lib/dms";
import { useCampusOrgs } from "../lib/campusOrgs";
import { clubChoices, clubsByPerson, type ClubRef } from "../lib/alumniClubs";
import { companiesOf, matchesAlum, orderAlumni } from "../lib/alumniSearch";
import { OPEN_LABEL, OPEN_TO, useAlumni, type Alum, type AlumFields, type OpenTo, type Req } from "../lib/alumni";
import { useGraduation } from "../lib/graduation";
import { useDisplayName } from "../lib/displayName";
import { notice } from "../lib/notice";

type Tab = "directory" | "requests" | "me";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ago = (iso: string) => { const d = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)); return d < 1 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };

/** Alumni: the people who went before you, still reachable. The directory leads (who is where, and what connects you); your own path to the badge sits
 *  beside it. Nobody's email is shown: a chat opens only when the graduate says yes. */
export default function Alumni() {
  const { session } = useAuth();
  const me = session?.user.id;
  const { list, mine, reqs, ready, saveMine, removeMine, ask, answer } = useAlumni(me);
  const { grad } = useGraduation(me);
  const verified = grad?.status === "verified";
  const [tab, setTab] = useState<Tab>("directory");
  const { orgs } = useCampusOrgs();
  const byPerson = useMemo(() => clubsByPerson(orgs), [orgs]);
  const companies = useMemo(() => companiesOf(list), [list]);
  const waiting = reqs.filter((r) => r.incoming && r.status === "pending").length;
  const current: Tab = tab === "me" && !verified ? "directory" : tab;
  const tabs: [Tab, string, number?][] = [["directory", "Find people"], ["requests", "Requests", waiting], ...(verified ? [["me", mine ? "My listing" : "List yourself"] as [Tab, string]] : [])];
  // one sentence that says what is here
  const head = !ready ? "Alumni" : list.length === 0 ? "Be the first graduate listed here" : companies.length > 1 ? `${plural(list.length, "graduate")} you can reach, at ${companies.length} places` : `${plural(list.length, "graduate")} you can reach`;

  return (
    <div className="page alumni">
      <h1 className="sr">Alumni</h1>
      <header className="al-hero">
        <h2>{head}</h2>
        <p>People from your campus, each confirmed by a coordinator. Ask for an introduction: they choose whether to answer, and nobody sees your email.</p>
      </header>
      <div className="segment al-tabs" role="tablist" aria-label="Alumni">
        {tabs.map(([id, label, n]) => <button key={id} type="button" role="tab" aria-selected={current === id} onClick={() => setTab(id)}>{label}{n ? <span className="rem-count">{n}</span> : null}</button>)}
      </div>

      {current === "me" && verified
        ? <MyListing key={mine ? "saved" : "new"} mine={mine} year={grad.year} me={me ?? ""} clubs={byPerson.get(me ?? "") ?? []} save={saveMine} remove={removeMine} />
        : (
          <div className="al-layout">
            <div className="al-col">
              {current === "directory" && <Directory list={list} reqs={reqs} ready={ready} byPerson={byPerson} companies={companies} clubName={(id) => orgs.find((o) => o.id === id)?.name} ask={ask} seeRequests={() => setTab("requests")} />}
              {current === "requests" && <Requests reqs={reqs} answer={answer} find={() => setTab("directory")} />}
            </div>
            <aside className="al-side" aria-label="You and alumni">
              {me && <GraduationPanel userId={me} />}
              {verified && !mine && (
                <section className="al-note">
                  <h3>Students can’t find you yet</h3>
                  <p>List where you work and what you are happy to help with. You can hide it whenever you like.</p>
                  <button type="button" className="btn sm primary" onClick={() => setTab("me")}>List yourself</button>
                </section>
              )}
              <section className="al-note">
                <h3>How an introduction works</h3>
                <ol>
                  <li>Find someone at a place, in a field or from your club.</li>
                  <li>Send a short note saying what you are asking for.</li>
                  <li>If they accept, a chat opens between the two of you.</li>
                </ol>
                <p>Up to 5 requests a day, so every one gets read.</p>
              </section>
            </aside>
          </div>
        )}
    </div>
  );
}

type DirectoryProps = {
  list: Alum[]; reqs: Req[]; ready: boolean; byPerson: Map<string, ClubRef[]>; companies: { name: string; count: number }[];
  clubName: (id: string) => string | undefined; ask: (id: string, note: string) => Promise<string | null>; seeRequests: () => void;
};

function Directory({ list, reqs, ready, byPerson, companies, clubName, ask, seeRequests }: DirectoryProps) {
  const [q, setQ] = useState("");
  const [want, setWant] = useState<OpenTo | "">("");
  const [company, setCompany] = useState("");
  const [asking, setAsking] = useState<Alum | null>(null);
  // the club filter lives in the address, so a club page can link straight to its own graduates
  const [params, setParams] = useSearchParams();
  const club = params.get("club") ?? "";
  const setClub = (id: string) => setParams(id ? { club: id } : {}, { replace: true });
  const choices = useMemo(() => clubChoices(list.map((a) => a.id), byPerson), [list, byPerson]);
  const shown = useMemo(() => orderAlumni(list.filter((a) => matchesAlum(a, { q, want, company, club }, byPerson.get(a.id) ?? [])), byPerson), [list, q, want, company, club, byPerson]);
  const filtered = !!(q.trim() || want || company || club);
  const clear = () => { setQ(""); setWant(""); setCompany(""); setClub(""); };
  /** Where things stand with this person, from your own side. */
  const withThem = (id: string) => reqs.find((r) => !r.incoming && r.otherId === id && r.status !== "declined");

  if (!ready) return <div className="al-cards" aria-busy="true" aria-label="Loading alumni"><div className="skeleton sk-card" /><div className="skeleton sk-card" /></div>;
  if (list.length === 0) return <EmptyState icon={GraduationCap} title="No graduates listed yet">When a graduate is confirmed and lists themselves, you will find them here with where they work and what they will help with.</EmptyState>;

  return (
    <section aria-label="Find people">
      <div className="al-bar">
        <label className="al-find">
          <Search size={18} aria-hidden="true" />
          <span className="sr">Search by name, company, field, club or year</span>
          <input type="search" placeholder="Search a company, a field, a club or a name" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {(choices.length > 0 || club) && (
          <label className="al-pick">
            <span className="sr">Club or community</span>
            <select value={club} onChange={(e) => setClub(e.target.value)}>
              <option value="">Any club</option>
              {club && !choices.some((c) => c.id === club) && <option value={club}>{clubName(club) ?? "That club"} (none listed)</option>}
              {choices.some((c) => c.mine) && <optgroup label="Your clubs">{choices.filter((c) => c.mine).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}</optgroup>}
              {choices.some((c) => !c.mine) && <optgroup label="Other clubs">{choices.filter((c) => !c.mine).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}</optgroup>}
            </select>
          </label>
        )}
      </div>

      {companies.length > 1 && (
        <div className="al-places" role="group" aria-label="Where they work">
          <span aria-hidden="true">Where they work</span>
          {companies.slice(0, 8).map((c) => <button key={c.name} type="button" aria-pressed={company === c.name} onClick={() => setCompany(company === c.name ? "" : c.name)}>{c.name}<b>{c.count}</b></button>)}
        </div>
      )}

      <div className="al-help" role="group" aria-label="What they are open to">
        <span aria-hidden="true">Looking for</span>
        {OPEN_TO.map((o) => <button key={o} type="button" aria-pressed={want === o} onClick={() => setWant(want === o ? "" : o)}>{OPEN_LABEL[o]}</button>)}
      </div>

      <p className="al-count-line" role="status">{filtered ? `${shown.length} of ${plural(list.length, "graduate")}` : "People from your clubs come first"}{filtered && <button type="button" className="link-btn" onClick={clear}>Clear filters</button>}</p>

      {shown.length === 0
        ? <EmptyState icon={Search} title={club && !q && !want && !company ? `No graduates from ${clubName(club) ?? "that club"} yet` : "No one matches that"}>Clear the filters to see everyone.</EmptyState>
        : <ul className="al-cards">{shown.map((a) => {
          const r = withThem(a.id);
          return (
            <li key={a.id}>
              <AlumniCard a={a} clubs={byPerson.get(a.id) ?? []} action={
                r?.status === "accepted" ? <MessageButton id={a.id} name={a.name} />
                  : r ? <button type="button" className="btn sm" onClick={seeRequests}><Check size={14} aria-hidden="true" /> Requested</button>
                  : <button type="button" className="btn sm alc-ask" onClick={() => setAsking(a)} aria-label={`Ask ${a.name} for an introduction`}>Ask for an introduction</button>} />
            </li>
          );
        })}</ul>}

      {asking && <AlumniAsk person={asking} shared={(byPerson.get(asking.id) ?? []).filter((c) => c.mine).map((c) => c.name)} onClose={() => setAsking(null)}
        onSend={async (note) => {
          const p = await ask(asking.id, note);
          if (!p) { notice.show({ icon: "wifi", title: "Request sent", message: `${asking.name} will see your note and can answer when they are ready.`, ms: 5000 }); setAsking(null); }
          return p;
        }} />}
    </section>
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

const STATE: Record<Req["status"], string> = { pending: "Waiting", accepted: "Accepted", declined: "Not this time" };

function Requests({ reqs, answer, find }: { reqs: Req[]; answer: (id: string, accept: boolean) => Promise<string | null>; find: () => void }) {
  const incoming = reqs.filter((r) => r.incoming);
  const sent = reqs.filter((r) => !r.incoming);
  const respond = async (id: string, yes: boolean) => { const p = await answer(id, yes); if (p) notice.show({ icon: "wifi", title: "That did not work", message: p }); };
  if (reqs.length === 0) return (
    <>
      <EmptyState icon={MessageSquare} title="No requests yet">What you ask, and what others ask of you, shows up here.</EmptyState>
      <p className="al-center"><button type="button" className="btn sm primary" onClick={find}>Find people</button></p>
    </>
  );
  const row = (r: Req) => (
    <li key={r.id} className="al-req">
      <PersonLink id={r.otherId} className="cf-avlink" decorative><Avatar name={r.other} id={r.otherId} size={44} /></PersonLink>
      <div>
        <p className="al-req-top"><PersonLink id={r.otherId} className="who-link"><strong>{r.other}</strong></PersonLink><AlumBadge id={r.otherId} /><span>{ago(r.at)}</span></p>
        <blockquote>{r.note}</blockquote>
        <div className="al-req-foot">
          {!(r.incoming && r.status === "pending") && <span className="al-state" data-s={r.status}>{r.incoming ? (r.status === "accepted" ? "You accepted" : "You declined") : STATE[r.status]}</span>}
          {r.incoming && r.status === "pending" && <><button type="button" className="btn sm primary" onClick={() => void respond(r.id, true)}><Check size={14} aria-hidden="true" /> Accept</button><button type="button" className="btn sm" onClick={() => void respond(r.id, false)}><X size={14} aria-hidden="true" /> Decline</button></>}
          {r.status === "accepted" && <MessageButton id={r.otherId} name={r.other} />}
        </div>
      </div>
    </li>
  );
  return (
    <section aria-label="Requests">
      {incoming.length > 0 && <><h3 className="al-h">Asked of you</h3><ul className="al-reqs">{incoming.map(row)}</ul></>}
      {sent.length > 0 && <><h3 className="al-h">You asked</h3><ul className="al-reqs">{sent.map(row)}</ul></>}
    </section>
  );
}

/** Your listing, with the card students will see beside the form as you type. */
function MyListing({ mine, year, me, clubs, save, remove }: { mine: AlumFields | null; year: number; me: string; clubs: ClubRef[]; save: (f: AlumFields) => Promise<string | null>; remove: () => Promise<string | null> }) {
  const name = useDisplayName() || "You";
  const [f, setF] = useState<AlumFields>(mine ?? { gradYear: year, field: "", company: "", jobTitle: "", industry: "", about: "", openTo: [], listed: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof AlumFields>(k: K, v: AlumFields[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (o: OpenTo) => setF((x) => ({ ...x, openTo: x.openTo.includes(o) ? x.openTo.filter((y) => y !== o) : [...x.openTo, o] }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const p = await save(f);
    setBusy(false);
    if (p) { setError(p); return; }
    notice.show({ icon: "wifi", title: mine ? "Listing updated" : "You are listed", message: f.listed ? "Students can find you and ask for an introduction." : "Saved. You are hidden from the directory.", ms: 4500 });
  }
  return (
    <div className="al-layout">
      <div className="al-col">
        <form className="al-form" onSubmit={submit} aria-label="My alumni listing">
          <fieldset>
            <legend>Where you are now</legend>
            <label>Company<input maxLength={80} value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Where you work, or are about to" /></label>
            <label>Job title<input maxLength={80} value={f.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="Software engineer" /></label>
            <label>Industry<input maxLength={60} value={f.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Technology, healthcare, finance" /></label>
            <label>What you studied<input maxLength={80} value={f.field} onChange={(e) => set("field", e.target.value)} placeholder="Computer Science" /></label>
          </fieldset>
          <fieldset>
            <legend>How you can help</legend>
            <div className="al-help">{OPEN_TO.map((o) => <button key={o} type="button" aria-pressed={f.openTo.includes(o)} onClick={() => toggle(o)}>{OPEN_LABEL[o]}</button>)}</div>
            <label className="al-wide">A line for students<textarea rows={3} maxLength={300} value={f.about} onChange={(e) => set("about", e.target.value)} placeholder="What you are happy to help with, in your words" /></label>
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
      </div>
      <aside className="al-side" aria-label="Preview">
        <h3 className="al-preview-h">{f.listed ? "What students see" : "Hidden from the directory"}</h3>
        <div className={f.listed ? undefined : "al-hidden"}><AlumniCard preview a={{ ...f, id: me, name }} clubs={clubs.map((c) => ({ ...c, mine: false }))} /></div>
        <p className="muted al-preview-note">Class of {year} was confirmed by a coordinator and can’t be edited here.</p>
      </aside>
    </div>
  );
}
