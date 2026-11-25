import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, GraduationCap, X } from "lucide-react";
import { gradLabel, isDue, MONTHS, monthsAway, useGraduation, type Graduation } from "../lib/graduation";
import { useBackupEmail } from "../lib/backupEmail";
import { notice } from "../lib/notice";

type Api = ReturnType<typeof useGraduation>;
const NOW = new Date();
const YEARS = Array.from({ length: NOW.getFullYear() + 7 - 1990 + 1 }, (_, i) => NOW.getFullYear() + 7 - i);

/** Pick the month and year you graduate, or graduated. */
function DateForm({ start, api, onDone, onCancel }: { start: Graduation | null; api: Api; onDone?: () => void; onCancel?: () => void }) {
  const [month, setMonth] = useState(start?.month ?? 5);
  const [year, setYear] = useState(start?.year ?? NOW.getFullYear() + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const p = await api.setDate(month, year);
    setBusy(false);
    if (p) { setError(p); return; }
    onDone?.();
  }
  return (
    <form className="grad-date" onSubmit={save}>
      <label>Month<select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
      <label>Year<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{YEARS.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
      <button className="btn sm primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      {onCancel && <button type="button" className="btn sm" onClick={onCancel}>Cancel</button>}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

/** "Yes, I graduated": the major and the name on the degree are what a coordinator can check against school records. */
function ClaimForm({ api, onCancel }: { api: Api; onCancel: () => void }) {
  const [proof, setProof] = useState(api.grad?.proof ?? "");
  const [major, setMajor] = useState(api.grad?.major ?? "");
  const [degreeName, setDegreeName] = useState(api.grad?.gradName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(e: FormEvent) {
    e.preventDefault();
    if (major.trim().length < 2 || degreeName.trim().length < 2) { setError("Add your major and the name on your degree, so it can be checked."); return; }
    setBusy(true); setError("");
    const p = await api.claim(proof, major, degreeName);
    setBusy(false);
    if (p) { setError(p); return; }
    notice.show({ icon: "calendar", title: "Congratulations", message: "A coordinator will check it against school records. You will get a notification.", ms: 6000 });
  }
  return (
    <form className="al-ask" onSubmit={send}>
      <label>Your major
        <input autoFocus required maxLength={80} value={major} onChange={(e) => setMajor(e.target.value)} placeholder="Computer Science" />
      </label>
      <label>Name on your degree
        <input required maxLength={100} autoComplete="name" value={degreeName} onChange={(e) => setDegreeName(e.target.value)} placeholder="As the school has it" />
      </label>
      <label>Anything else that helps? (optional)
        <textarea rows={2} maxLength={300} value={proof} onChange={(e) => setProof(e.target.value)} />
      </label>
      <p className="muted">Only you and your campus coordinators see these.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="al-actions"><button className="btn sm primary" disabled={busy}>{busy ? "Sending…" : "Send for confirmation"}</button><button type="button" className="btn sm" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

const STEPS = ["Graduation date", "You confirm", "Coordinator checks", "Alumni"] as const;
const stepOf = (g: Graduation | null) => (!g ? 0 : g.status === "verified" ? 3 : g.status === "claimed" ? 2 : 1);

/** Where you are on the way to the Alumni badge, and the one thing to do next. Used on the Alumni page and in Profile settings. */
export function GraduationPanel({ userId, headingLevel = 2, compact = false }: { userId: string; headingLevel?: 2 | 3; compact?: boolean }) {
  const [opened, setOpened] = useState(false);
  const api = useGraduation(userId);
  const { email: personal } = useBackupEmail(userId);
  const [mode, setMode] = useState<"view" | "date" | "claim">("view");
  const g = api.grad;
  if (g === undefined) return null;
  const at = stepOf(g);
  const H = `h${headingLevel}` as "h2" | "h3";
  const title = !g ? "When do you graduate?" : g.status === "verified" ? `You are an alum, class of ${g.year}` : g.status === "claimed" ? "Waiting for a coordinator" : g.status === "declined" ? "We could not confirm it yet" : isDue(g) ? "Have you graduated?" : `Graduating ${gradLabel(g)}`;

  // nothing to do yet (no date, or the month has not come): one line, opened on request
  const quiet = compact && !opened && mode === "view" && (!g || (g.status === "expected" && !isDue(g)));
  if (quiet) return (
    <section className="grad-line" aria-label="Graduation">
      <GraduationCap size={16} aria-hidden="true" />
      <span>{g ? `You graduate ${gradLabel(g)}` : "Graduating, or graduated?"}</span>
      <button type="button" className="link-btn" onClick={() => setOpened(true)}>{g ? "Details" : "Add your date"}</button>
      {personal === null && <p><Link to="/app/profile?tab=settings">Add a personal email</Link> so you keep your account after school.</p>}
    </section>
  );

  return (
    <section className="grad-panel" aria-label="Graduation">
      <H>{title}</H>
      <ol className="grad-steps">
        {STEPS.map((s, i) => <li key={s} data-state={i < at || g?.status === "verified" ? "done" : i === at ? "now" : "next"} aria-current={i === at && g?.status !== "verified" ? "step" : undefined}><span aria-hidden="true">{i < at || g?.status === "verified" ? <Check size={12} /> : i + 1}</span>{s}</li>)}
      </ol>

      {(!g || mode === "date") && <>
        {!g && <p className="muted">Pick the month you graduate, or the month you graduated. We will check in then.</p>}
        <DateForm start={g} api={api} onDone={() => setMode("view")} onCancel={g ? () => setMode("view") : undefined} />
      </>}

      {g && mode === "claim" && <ClaimForm api={api} onCancel={() => setMode("view")} />}

      {g && mode === "view" && <>
        {g.status === "expected" && !isDue(g) && <p className="muted">When {gradLabel(g)} arrives we will ask you to confirm, here and by email. You keep using Orbit the same way before and after.</p>}
        {g.status === "expected" && isDue(g) && <p className="muted">Confirm it to get the Alumni badge. You keep everything you have on Orbit.</p>}
        {g.status === "claimed" && <p className="muted">You said you graduated in {gradLabel(g)}. A coordinator checks your major and name against school records, so the badge means something. This usually takes a few days, and Orbit works as usual while you wait.</p>}
        {g.status === "declined" && <p className="muted">{g.note ? `The coordinator said: ${g.note}` : "A coordinator could not confirm it."} Check your date and send it again.</p>}
        {g.status === "verified" && <p className="muted">You graduated in {gradLabel(g)}. Your badge shows beside your name, and you can list yourself so students can reach you.</p>}
        <div className="al-actions">
          {g.status === "claimed" && <button type="button" className="btn sm" onClick={async () => { const p = await api.withdraw(); if (p) notice.show({ icon: "alert", title: "That did not work", message: p }); }}>Take it back</button>}
          {g.status !== "claimed" && g.status !== "verified" && isDue(g) && <button type="button" className="btn sm primary" onClick={() => setMode("claim")}>{g.status === "declined" ? "Send it again" : "Yes, I graduated"}</button>}
          {(g.status === "expected" || g.status === "declined") && <button type="button" className="btn sm" onClick={() => setMode("date")}>{isDue(g) ? "Not yet, change the date" : "Change the date"}</button>}
        </div>
      </>}

      {personal === null && <p className="al-warn" role="note">Your school email will be deleted after you leave. <Link to="/app/profile?tab=settings">Add a personal email</Link> so you can still sign in and hear from people.</p>}
    </section>
  );
}

const LATER = (id: string) => `orbit-grad-later:${id}`;

/** On Home: asks the one graduation question that is due. When you graduate, or whether you have; then a nudge to keep a way in. */
export function GraduationPrompt({ userId }: { userId: string }) {
  const api = useGraduation(userId);
  const { email: personal } = useBackupEmail(userId);
  const [claiming, setClaiming] = useState(false);
  const [shut, setShut] = useState(() => { try { return Number(localStorage.getItem(LATER(userId)) ?? 0) > Date.now(); } catch { return false; } });
  const g = api.grad;
  if (!userId || g === undefined) return null;
  const due = !!g && g.status === "expected" && isDue(g);
  const soon = !!g && g.status === "expected" && !isDue(g) && monthsAway(g) <= 3;
  const needsEmail = personal === null && (soon || g?.status === "claimed" || g?.status === "verified");
  const snoozed = !!g?.snoozeUntil && g.snoozeUntil > new Date().toISOString().slice(0, 10);
  if (shut || (due && snoozed) || (g && !due && !needsEmail)) return null;
  const later = () => {
    try { localStorage.setItem(LATER(userId), String(Date.now() + 14 * 86400_000)); } catch { /* it still closes */ }
    if (due) void api.snooze();
    setShut(true);
  };
  return (
    <section className="grad-card" aria-label="Graduation">
      <GraduationCap size={22} aria-hidden="true" />
      <div>
        {!g && <><h2>When do you graduate?</h2><p className="muted">Or when did you? We will check in that month, and graduates get an Alumni badge.</p><DateForm start={null} api={api} /></>}
        {due && <><h2>Have you graduated?</h2><p className="muted">You said {gradLabel(g)}. Confirm it to get the Alumni badge. You keep everything on Orbit.</p>
          {claiming ? <ClaimForm api={api} onCancel={() => setClaiming(false)} />
            : <div className="al-actions"><button type="button" className="btn sm primary" onClick={() => setClaiming(true)}>Yes, I graduated</button><Link className="btn sm" to="/app/alumni">Not yet, change the date</Link><button type="button" className="link-btn" onClick={later}>Remind me later</button></div>}</>}
        {g && !due && needsEmail && <><h2>Keep your way in</h2><p className="muted">Your school email will be deleted after you leave. Add a personal email so you keep your account and the people you know here.</p>
          <div className="al-actions"><Link className="btn sm primary" to="/app/profile?tab=settings">Add a personal email</Link></div></>}
      </div>
      <button type="button" className="link-btn grad-x" aria-label="Close for two weeks" onClick={later}><X size={16} aria-hidden="true" /></button>
    </section>
  );
}
