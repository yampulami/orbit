import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Copy, GraduationCap, MessageSquare, Search, X } from "lucide-react";
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
import { useBackupEmail } from "../lib/backupEmail";
import { useDisplayName } from "../lib/displayName";
import { notice } from "../lib/notice";
import { undo } from "../lib/undo";

type Tab = "directory" | "requests" | "me";
const asTab = (v: string | null): Tab | null => (v === "directory" || v === "requests" || v === "me" ? v : null);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const daysSince = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
const ago = (iso: string) => { const d = daysSince(iso); return d < 1 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };
/** A no is respected for this long (the server holds to it too). */
const WAIT_AFTER_NO = 90;
/** School addresses are the ones that get deleted. */
const SCHOOL_ADDRESS = /\.(edu|ac)(\.[a-z]{2,3})?$/i;
const SITE = "https://www.orbitcampus.org";

/** Alumni: the people who went before you, still reachable. People from your own clubs lead (the warmest introduction), then everyone else;
 *  your own path to the badge sits beside them. Nobody's email is shown: a chat opens only when the graduate says yes. */
export default function Alumni() {
  const { session } = useAuth();
  const me = session?.user.id;
  const { list, mine, reqs, ready, failed, saveMine, removeMine, ask, answer, withdraw, reload } = useAlumni(me);
  const { grad } = useGraduation(me);
  const verified = grad?.status === "verified";
  // the tab is in the address, so a notification or an email opens the right one
  const [params, setParams] = useSearchParams();
  const { orgs } = useCampusOrgs();
  const byPerson = useMemo(() => clubsByPerson(orgs), [orgs]);
  const companies = useMemo(() => companiesOf(list), [list]);
  const waiting = reqs.filter((r) => r.incoming && r.status === "pending").length;
  const asked = asTab(params.get("tab"));
  const wanted: Tab = asked ?? (waiting > 0 ? "requests" : "directory");
  const current: Tab = wanted === "me" && !verified ? "directory" : wanted;
  const setTab = (t: Tab) => setParams((p) => { const n = new URLSearchParams(p); n.set("tab", t); return n; }, { replace: true });
  const tabs: [Tab, string, number?][] = [["directory", "Find people"], ["requests", "Requests", waiting], ...(verified ? [["me", mine ? "My listing" : "List yourself"] as [Tab, string]] : [])];
  const listedMe = !!mine?.listed;
  // one sentence that says what is here, true for whoever is reading it
  const head = !ready || failed ? "Alumni"
    : list.length > 0 ? (companies.length > 1 ? `${plural(list.length, "graduate")} you can reach, at ${companies.length} places` : `${plural(list.length, "graduate")} you can reach`)
    : "You’re the first graduate here";
  // with nobody listed (and not you either), the empty picture below says it once
  const quietHead = ready && !failed && list.length === 0 && !listedMe;

  return (
    <div className="page alumni">
      <h1 className="sr">Alumni</h1>
      {!quietHead && (
        <header className="al-hero">
          <h2>{head}</h2>
          {list.length > 0 && <p>Checked by your campus. Your email stays private.</p>}
        </header>
      )}
      <div className="segment al-tabs" role="tablist" aria-label="Alumni">
        {tabs.map(([id, label, n]) => <button key={id} id={`al-tab-${id}`} type="button" role="tab" aria-controls="al-panel" aria-selected={current === id} onClick={() => setTab(id)}>{label}{n ? <span className="rem-count">{n}</span> : null}</button>)}
      </div>

      <div id="al-panel" role="tabpanel" aria-labelledby={`al-tab-${current}`}>
        {current === "me" && verified
          ? <MyListing key={mine ? "saved" : "new"} mine={mine} year={grad.year} major={grad.major ?? ""} me={me ?? ""} clubs={byPerson.get(me ?? "") ?? []} save={saveMine} remove={removeMine} />
          : (
            <div className="al-layout">
              <div className="al-col">
                {failed
                  ? <><EmptyState icon={GraduationCap} title="Alumni did not load">Check your connection, then try again.</EmptyState><p className="al-center"><button type="button" className="btn sm primary" onClick={() => void reload()}>Try again</button></p></>
                  : current === "directory"
                    ? <Directory list={list} reqs={reqs} ready={ready} byPerson={byPerson} companies={companies} clubName={(id) => orgs.find((o) => o.id === id)?.name} ask={ask} seeRequests={() => setTab("requests")} verified={verified} listMe={() => setTab("me")}
                      own={listedMe && mine ? <OwnCard mine={mine} me={me ?? ""} clubs={byPerson.get(me ?? "") ?? []} /> : null} />
                    : <Requests reqs={reqs} byPerson={byPerson} answer={answer} withdraw={withdraw} find={() => setTab("directory")} />}
              </div>
              <aside className="al-side" aria-label="You and alumni">
                {me && <GraduationPanel userId={me} compact />}
                {verified && !listedMe && (
                  <section className="al-note">
                    <h2>Students can’t find you yet</h2>
                    <button type="button" className="btn sm primary" onClick={() => setTab("me")}>List yourself</button>
                  </section>
                )}
                <details className="al-note al-how">
                  <summary>How introductions work</summary>
                  <ol>
                    <li>Send a short note.</li>
                    <li>They decide whether to accept.</li>
                    <li>If they do, a chat opens.</li>
                  </ol>
                  <p>Up to 5 requests a day.</p>
                </details>
              </aside>
            </div>
          )}
      </div>
    </div>
  );
}

type DirectoryProps = {
  list: Alum[]; reqs: Req[]; ready: boolean; byPerson: Map<string, ClubRef[]>; companies: { name: string; count: number }[];
  clubName: (id: string) => string | undefined; ask: (id: string, note: string) => Promise<string | null>; seeRequests: () => void;
  verified: boolean; listMe: () => void; own: ReactNode;
};

function Directory({ list, reqs, ready, byPerson, companies, clubName, ask, seeRequests, verified, listMe, own }: DirectoryProps) {
  const [q, setQ] = useState("");
  const [want, setWant] = useState<OpenTo | "">("");
  const [company, setCompany] = useState("");
  const [asking, setAsking] = useState<Alum | null>(null);
  // the club filter lives in the address, so a club page can link straight to its own graduates
  const [params, setParams] = useSearchParams();
  const club = params.get("club") ?? "";
  const setClub = (id: string) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set("club", id); else n.delete("club"); return n; }, { replace: true });
  const choices = useMemo(() => clubChoices(list.map((a) => a.id), byPerson), [list, byPerson]);
  const shown = useMemo(() => orderAlumni(list.filter((a) => matchesAlum(a, { q, want, company, club }, byPerson.get(a.id) ?? [])), byPerson), [list, q, want, company, club, byPerson]);
  const filtered = !!(q.trim() || want || company || club);
  const clear = () => { setQ(""); setWant(""); setCompany(""); setClub(""); };
  const sharesAClub = (a: Alum) => (byPerson.get(a.id) ?? []).some((c) => c.mine);
  const near = filtered ? [] : shown.filter(sharesAClub);
  const rest = near.length ? shown.filter((a) => !sharesAClub(a)) : shown;
  // a company is only worth a button when it gathers people
  const places = companies.filter((c) => c.count > 1).slice(0, 8);
  const helps = OPEN_TO.filter((o) => list.some((a) => a.openTo.includes(o)));

  /** Where things stand with this person, from your own side, and the one thing to do about it. */
  const action = (a: Alum, warm: boolean) => {
    const mineTo = reqs.filter((r) => !r.incoming && r.otherId === a.id);
    if (mineTo.some((r) => r.status === "accepted")) return <MessageButton id={a.id} name={a.name} />;
    if (mineTo.some((r) => r.status === "pending")) return <button type="button" className="btn sm" onClick={seeRequests}><Check size={14} aria-hidden="true" /> Requested · view</button>;
    if (mineTo.some((r) => r.status === "declined" && daysSince(r.decidedAt ?? r.at) < WAIT_AFTER_NO)) return <p className="alc-later">You asked recently. You can ask again later.</p>;
    return <button type="button" className={"btn sm alc-ask" + (warm ? " primary" : "")} onClick={() => setAsking(a)} aria-label={`Ask ${a.name} for an introduction`}>Ask for an introduction</button>;
  };
  const cards = (people: Alum[], warm: boolean) => <ul className="al-cards">{people.map((a) => <li key={a.id}><AlumniCard a={a} clubs={byPerson.get(a.id) ?? []} action={action(a, warm)} /></li>)}</ul>;

  if (!ready) return <div className="al-cards" aria-busy="true" aria-label="Loading alumni"><div className="skeleton sk-card" /><div className="skeleton sk-card" /></div>;
  if (list.length === 0) {
    const invite = async () => {
      try { await navigator.clipboard.writeText(SITE); notice.show({ icon: "calendar", title: "Link copied", message: "Send it to a graduate you know. They sign in, say when they graduated, and get confirmed.", ms: 6000 }); }
      catch { notice.show({ icon: "alert", title: "Could not copy", message: `Send them ${SITE}`, ms: 8000 }); }
    };
    const inviteButton = <button type="button" className="btn sm" onClick={() => void invite()}><Copy size={14} aria-hidden="true" /> Invite a graduate</button>;
    // you are the only one listed: your own card is the page, as students see it
    if (own) return (
      <section className="al-first" aria-label="Your listing">
        {own}
        <div className="al-actions"><button type="button" className="btn sm primary" onClick={listMe}>Edit my listing</button>{inviteButton}</div>
      </section>
    );
    return (
      <>
        <EmptyState icon={GraduationCap} title="No graduates listed yet">{verified ? "List yourself so students can reach you." : "Confirmed graduates show up here."}</EmptyState>
        <p className="al-center">{verified ? <button type="button" className="btn sm primary" onClick={listMe}>List yourself</button> : inviteButton}</p>
      </>
    );
  }

  return (
    <section aria-label="Find people">
      <div className="al-bar">
        <label className="al-find">
          <Search size={18} aria-hidden="true" />
          <span className="sr">Search by name, company, field, club or year</span>
          <input type="search" placeholder="Company, field, club or name" value={q} onChange={(e) => setQ(e.target.value)} />
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
        {helps.length > 1 && (
          <label className="al-pick">
            <span className="sr">What they are open to</span>
            <select value={want} onChange={(e) => setWant(e.target.value as OpenTo | "")}>
              <option value="">Any kind of help</option>
              {helps.map((o) => <option key={o} value={o}>{OPEN_LABEL[o]}</option>)}
            </select>
          </label>
        )}
      </div>

      {places.length > 0 && (
        <div className="al-places" role="group" aria-label="Where several of them work">
          {places.map((c) => <button key={c.name} type="button" aria-pressed={company === c.name} onClick={() => setCompany(company === c.name ? "" : c.name)}>{c.name}<b>{c.count}</b></button>)}
        </div>
      )}

      <p className="al-count-line" role="status">{filtered && <>{shown.length} of {plural(list.length, "graduate")}<button type="button" className="link-btn" onClick={clear}>Clear filters</button></>}</p>

      {shown.length === 0
        ? <EmptyState icon={Search} title={club && !q && !want && !company ? `No graduates from ${clubName(club) ?? "that club"} yet` : "No one matches that"}>Clear the filters to see everyone.</EmptyState>
        : (
          <>
            {near.length > 0 && (
              <section className="al-near" aria-labelledby="al-near-h">
                <h2 id="al-near-h">From your clubs</h2>
                {cards(near, true)}
              </section>
            )}
            {rest.length > 0 && (
              <section aria-label={near.length ? "More graduates" : "Graduates"}>
                {near.length > 0 && <h2 className="al-rest-h">More graduates</h2>}
                {cards(rest, false)}
              </section>
            )}
          </>
        )}

      {asking && <AlumniAsk person={asking} shared={(byPerson.get(asking.id) ?? []).filter((c) => c.mine).map((c) => c.name)} onClose={() => setAsking(null)}
        onSend={async (note) => {
          const p = await ask(asking.id, note);
          if (!p) { notice.show({ icon: "calendar", title: `Sent to ${asking.name}`, message: "You will get a notification if they accept. You can take it back from Requests until then.", ms: 7000 }); setAsking(null); }
          return p;
        }} />}
    </section>
  );
}

/** Your listing drawn the way students see it. */
function OwnCard({ mine, me, clubs }: { mine: AlumFields; me: string; clubs: ClubRef[] }) {
  const name = useDisplayName() || "You";
  return <AlumniCard preview a={{ ...mine, id: me, name }} clubs={clubs.map((c) => ({ ...c, mine: false }))} />;
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

const STATE: Record<Req["status"], string> = { pending: "Waiting for an answer", accepted: "Accepted", declined: "Not this time" };

type RequestsProps = { reqs: Req[]; byPerson: Map<string, ClubRef[]>; answer: (id: string, accept: boolean) => Promise<string | null>; withdraw: (id: string) => Promise<string | null>; find: () => void };

function Requests({ reqs, byPerson, answer, withdraw, find }: RequestsProps) {
  const incoming = reqs.filter((r) => r.incoming);
  const sent = reqs.filter((r) => !r.incoming);
  const say = (p: string | null) => { if (p) notice.show({ icon: "alert", title: "That did not work", message: p }); };
  const respond = async (r: Req, yes: boolean) => {
    const p = await answer(r.id, yes);
    say(p);
    if (!p && yes) notice.show({ icon: "calendar", title: `You can talk to ${r.other} now`, message: "A good first message says what you can help with, and when.", ms: 6000 });
  };
  if (reqs.length === 0) return (
    <>
      <EmptyState icon={MessageSquare} title="No requests yet">What you ask, and what others ask of you, shows up here.</EmptyState>
      <p className="al-center"><button type="button" className="btn sm primary" onClick={find}>Find people</button></p>
    </>
  );
  const row = (r: Req) => {
    const shared = (byPerson.get(r.otherId) ?? []).filter((c) => c.mine).map((c) => c.name);
    return (
      <li key={r.id} className="al-req">
        <PersonLink id={r.otherId} className="cf-avlink" decorative><Avatar name={r.other} id={r.otherId} size={44} /></PersonLink>
        <div>
          <p className="al-req-top"><PersonLink id={r.otherId} className="who-link"><strong>{r.other}</strong></PersonLink><AlumBadge id={r.otherId} /><span>{ago(r.at)}</span></p>
          {shared.length > 0 && <p className="al-req-shared">You are both in {shared.slice(0, 2).join(" and ")}</p>}
          <blockquote>{r.note}</blockquote>
          <div className="al-req-foot">
            {!(r.incoming && r.status === "pending") && <span className="al-state" data-s={r.status}>{r.incoming ? (r.status === "accepted" ? "You accepted" : "You declined") : STATE[r.status]}</span>}
            {r.incoming && r.status === "pending" && <><button type="button" className="btn sm primary" onClick={() => void respond(r, true)}><Check size={14} aria-hidden="true" /> Accept</button><button type="button" className="btn sm" onClick={() => void respond(r, false)}><X size={14} aria-hidden="true" /> Decline</button></>}
            {!r.incoming && r.status === "pending" && <button type="button" className="link-btn" onClick={async () => say(await withdraw(r.id))}>Take back</button>}
            {r.status === "accepted" && <MessageButton id={r.otherId} name={r.other} />}
          </div>
        </div>
      </li>
    );
  };
  return (
    <section aria-label="Requests">
      {incoming.length > 0 && <><h2 className="al-h">Asked of you</h2><ul className="al-reqs">{incoming.map(row)}</ul></>}
      {sent.length > 0 && <><h2 className="al-h">You asked</h2><ul className="al-reqs">{sent.map(row)}</ul></>}
    </section>
  );
}

type ListingProps = { mine: AlumFields | null; year: number; major: string; me: string; clubs: ClubRef[]; save: (f: AlumFields) => Promise<string | null>; remove: () => Promise<string | null> };

/** Your listing, with the card students will see beside the form as you type. */
function MyListing({ mine, year, major, me, clubs, save, remove }: ListingProps) {
  const { session } = useAuth();
  const account = session?.user.email ?? "";
  const { email: personal } = useBackupEmail(me);
  const name = useDisplayName() || "You";
  const [f, setF] = useState<AlumFields>(mine ?? { gradYear: year, field: major, company: "", jobTitle: "", industry: "", about: "", openTo: [], listed: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  useEffect(() => { setError(""); }, [f]);
  const set = <K extends keyof AlumFields>(k: K, v: AlumFields[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (o: OpenTo) => setF((x) => ({ ...x, openTo: x.openTo.includes(o) ? x.openTo.filter((y) => y !== o) : [...x.openTo, o] }));
  // requests have to reach you after the school address is gone
  const reachable = !!personal || !SCHOOL_ADDRESS.test(account);
  const reachedAt = personal || account;
  const blocked = f.listed && personal !== undefined && !reachable;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.listed && !f.company.trim() && !f.field.trim()) { setError("Add a company, or what you studied."); return; }
    if (f.listed && f.openTo.length === 0 && !f.about.trim()) { setError("Pick how you can help, or write a line for students."); return; }
    setBusy(true); setError("");
    const p = await save(f);
    setBusy(false);
    if (p) { setError(p); return; }
    notice.show({ icon: "calendar", title: mine ? "Listing updated" : "You are listed", message: f.listed ? `Students can find you. Requests reach you in Orbit and at ${reachedAt}.` : "Saved. You are hidden from the directory.", ms: 6000 });
  }
  // removing waits a few seconds, so it can be taken back
  const takeDown = () => {
    setRemoving(true);
    undo.show("Your listing is being removed", {
      ms: 8000,
      onUndo: () => setRemoving(false),
      commit: async () => { const p = await remove(); setRemoving(false); if (p) { notice.show({ icon: "alert", title: "That did not work", message: p }); throw new Error(p); } },
    });
  };

  return (
    <div className="al-layout">
      <div className="al-col">
        {blocked && (
          <div className="al-block" role="alert">
            <h2>First, give us a way to reach you</h2>
            <p>Your account only has your school email ({account}), which the school will delete. Add a personal email, then list yourself.</p>
            <Link className="btn sm primary" to="/app/profile?tab=settings">Add a personal email</Link>
          </div>
        )}
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
            <button className="btn primary" disabled={busy || blocked || removing}>{busy ? "Saving…" : mine ? "Save changes" : "List me"}</button>
            {mine && !removing && <button type="button" className="link-btn" onClick={takeDown}>Remove my listing</button>}
          </div>
        </form>
      </div>
      <aside className="al-side" aria-label="Preview">
        <h2 className="al-preview-h">{f.listed ? "What students see" : "Hidden from the directory"}</h2>
        <div className={f.listed ? undefined : "al-hidden"}><AlumniCard preview a={{ ...f, id: me, name }} clubs={clubs.map((c) => ({ ...c, mine: false }))} /></div>
        {reachable && <p className="muted al-preview-note">Requests reach you in Orbit and, if you leave them unread, at {reachedAt}.</p>}
        <p className="muted al-preview-note">Class of {year} was confirmed by a coordinator and can’t be edited here. If it is wrong, ask a coordinator to take the confirmation back.</p>
      </aside>
    </div>
  );
}
