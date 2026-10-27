import { useState } from "react";
import { Pencil } from "lucide-react";
import { CATEGORIES, orgActions, type Org } from "../lib/campusOrgs";
import { notice } from "../lib/notice";
import { CvChips } from "./Converse";
import RichText from "./RichText";

/** A club's About: what it is, when it meets, its category. The president can edit it; everyone else reads it. */
export default function ClubAbout({ org, canEdit }: { org: Org; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [line, setLine] = useState(org.description);
  const [about, setAbout] = useState(org.about);
  const [category, setCategory] = useState(org.application.category);
  const [meeting, setMeeting] = useState(org.application.meeting);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const open = () => { setLine(org.description); setAbout(org.about); setCategory(org.application.category); setMeeting(org.application.meeting); setError(""); setEditing(true); };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await orgActions.updateProfile(org.id, { description: line, about, category, meeting });
    setBusy(false);
    if (err) { setError(err); return; }
    setEditing(false);
    notice.show({ icon: "calendar", title: "Saved", message: "Your club page is updated.", ms: 2500 });
  }

  if (editing) {
    return (
      <form className="about-edit" onSubmit={save}>
        <label className="field">One line under the name<input autoFocus value={line} maxLength={300} placeholder="Weekly games and tournaments for all levels" onChange={(e) => setLine(e.target.value)} /></label>
        <label className="field">About<textarea rows={6} value={about} maxLength={1500} placeholder="What you do, who can join, what a first visit looks like." onChange={(e) => setAbout(e.target.value)} /><span className="count">{about.length}/1500</span></label>
        <label className="field">When and where you meet<input value={meeting} maxLength={160} placeholder="Thursdays at 6 PM, Student Center room 204" onChange={(e) => setMeeting(e.target.value)} /></label>
        <div className="field"><span>Category</span><CvChips label="Category" options={CATEGORIES} value={category} onChange={(v) => setCategory(v as string)} /></div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="about-actions"><button className="btn sm primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button><button type="button" className="link-btn" onClick={() => setEditing(false)}>Cancel</button></div>
      </form>
    );
  }
  return (
    <div className="about-view">
      <div className="about-head"><h2>About</h2>{canEdit && <button type="button" className="btn sm" onClick={open}><Pencil size={14} aria-hidden="true" /> Edit</button>}</div>
      {org.about ? <p className="about-text"><RichText text={org.about} /></p> : <p className="muted">{canEdit ? "Tell people what your club is about. It shows here for everyone." : "This club has not written an About yet."}</p>}
      {(org.application.meeting || org.application.category) && (
        <dl className="about-facts">
          {org.application.meeting && <div><dt>Meets</dt><dd>{org.application.meeting}</dd></div>}
          {org.application.category && <div><dt>Category</dt><dd>{org.application.category}</dd></div>}
        </dl>
      )}
    </div>
  );
}
