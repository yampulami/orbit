import { useState, type FormEvent } from "react";
import { CATEGORIES, EMPTY_APP, orgActions, type Application, type OrgKind } from "../lib/campusOrgs";

/** The form for asking for a new club. Students send an application a coordinator reads in full; a coordinator or staff member sets one up directly. */
export default function ClubApplication({ reviewer, mode = "club", onSent, onCancel }: { reviewer: boolean; mode?: "club" | "circle"; onSent: (r: { id?: string; status?: string }) => void; onCancel: () => void }) {
  const circle = mode === "circle";
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [office, setOffice] = useState(false);
  const [app, setApp] = useState<Application>(EMPTY_APP);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const up = (k: keyof Application, v: string | number | null) => { setApp((a) => ({ ...a, [k]: v })); setError(""); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const kind: OrgKind = circle ? "circle" : reviewer && office ? "official" : "student";
    const r = await orgActions.request({ name, description: about, reviewer, kind, application: app });
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    onSent(r);
  }

  return (
    <form className="htools-form club-create club-apply" onSubmit={submit}>
      <h3>{circle ? "Start a student circle" : reviewer ? "Set up a club or office" : "Apply to start a club"}</h3>
      <p className="muted">{circle ? "A circle is a casual group for a shared interest. It starts right away, anyone can join, and it has its own feed and polls. It is not an official club, so it cannot post campus events." : reviewer ? "It is active as soon as you save it." : "A coordinator reads your application and decides. You will get a notification either way. Fill in as much as you can, it helps them say yes."}</p>
      <label className="field">{circle ? "Circle name" : "Club name"}<input autoFocus value={name} maxLength={80} placeholder="e.g. Chess Club" onChange={(e) => { setName(e.target.value); setError(""); }} /></label>
      <label className="field">One line for the club page<input value={about} maxLength={300} placeholder="Weekly games and tournaments for all levels." onChange={(e) => setAbout(e.target.value)} /></label>
      {circle && <label className="field">Category<select value={app.category} onChange={(e) => up("category", e.target.value)}><option value="">Choose one</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>}
      {reviewer && !circle && <label className="check-line"><input type="checkbox" checked={office} onChange={(e) => setOffice(e.target.checked)} /> This is a staff-run office (its events are Official)</label>}
      {!reviewer && !circle && (
        <>
          <label className="field">What is the club for, and who is it for?
            <textarea rows={3} value={app.purpose} maxLength={600} placeholder="A couple of sentences: what you do, who can join, why the campus needs it." onChange={(e) => up("purpose", e.target.value)} />
          </label>
          <div className="cevent-times">
            <label className="field">Category
              <select value={app.category} onChange={(e) => up("category", e.target.value)}><option value="">Choose one</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="field">How many people do you expect?<input inputMode="numeric" value={app.expectedMembers ?? ""} maxLength={5} placeholder="e.g. 25" onChange={(e) => up("expectedMembers", e.target.value.replace(/\D/g, "") ? Number(e.target.value.replace(/\D/g, "")) : null)} /></label>
          </div>
          <div className="cevent-times">
            <label className="field">Faculty or staff adviser<input value={app.advisorName} maxLength={80} placeholder="Name" onChange={(e) => up("advisorName", e.target.value)} /></label>
            <label className="field">Adviser email<input type="email" value={app.advisorEmail} maxLength={120} placeholder="name@university.edu" onChange={(e) => up("advisorEmail", e.target.value)} /></label>
          </div>
          <label className="field">Where and when will you meet?<input value={app.meeting} maxLength={160} placeholder="e.g. Thursdays 6 PM, Student Center room 2" onChange={(e) => up("meeting", e.target.value)} /></label>
          <label className="field">First event you would hold (optional)<input value={app.firstEvent} maxLength={300} placeholder="e.g. Open tournament in week 3" onChange={(e) => up("firstEvent", e.target.value)} /></label>
          <label className="field">How can the coordinator reach you?<input value={app.contact} maxLength={120} placeholder="Email or phone" onChange={(e) => up("contact", e.target.value)} /></label>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="about-actions"><button className="btn primary" disabled={busy}>{busy ? "Sending…" : circle ? "Start circle" : reviewer ? "Create" : "Send application"}</button><button type="button" className="btn" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}
