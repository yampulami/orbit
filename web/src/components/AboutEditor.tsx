import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { BIO_MAX, HOBBY_IDEAS, HOBBY_LEN, HOBBY_MAX, bioLength, cleanBio, cleanHobbies, loadAbout, saveAbout, type About } from "../lib/about";
import { notice } from "../lib/notice";
import EmojiButton from "./EmojiButton";
import RichText from "./RichText";

/** The bio and free-time tags, for the person's own profile: shows them, and lets them add or change them. Anyone on the campus sees them on the profile page. */
export default function AboutEditor({ userId }: { userId: string }) {
  const [about, setAbout] = useState<About | null>(null);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    loadAbout(userId).then((a) => { if (alive) setAbout(a); }, () => { if (alive) setAbout({ bio: "", hobbies: [] }); });
    return () => { alive = false; };
  }, [userId]);

  const has = !!about && (about.bio.length > 0 || about.hobbies.length > 0);
  function start() { setBio(about?.bio ?? ""); setHobbies(about?.hobbies ?? []); setTag(""); setError(""); setEditing(true); }
  const setBioChecked = (v: string) => { if (bioLength(v) <= BIO_MAX) setBio(v); };
  const addTag = (t: string) => { setHobbies((l) => cleanHobbies([...l, t])); setTag(""); };
  const toggleIdea = (t: string) => setHobbies((l) => (l.some((x) => x.toLowerCase() === t.toLowerCase()) ? l.filter((x) => x.toLowerCase() !== t.toLowerCase()) : cleanHobbies([...l, t])));

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const next = { bio: cleanBio(bio), hobbies: cleanHobbies(tag.trim() ? [...hobbies, tag] : hobbies) };
    const problem = await saveAbout(userId, next);
    setSaving(false);
    if (problem) { setError(problem); return; }
    setAbout(next); setEditing(false);
    notice.show({ icon: "pin", title: "Your profile is updated", message: "Everyone on your campus sees this when they open your profile.", ms: 3500 });
  }

  if (!about) return <section className="about-card" aria-busy="true"><div className="skeleton sk-line" /><div className="skeleton sk-line short" /></section>;

  return (
    <section className="about-card" aria-label="About you">
      <header>
        <div>
          <h2>About you</h2>
          <p className="muted">{has ? "What people see when they open your profile." : "Tell people a little about yourself: what you are into and what you do in your free time."}</p>
        </div>
        {!editing && <button type="button" className="btn" onClick={start}>{has ? <Pencil size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}{has ? "Edit" : "Add a bio"}</button>}
      </header>

      {!editing && has && (
        <div className="about-view">
          {about.bio && <p className="about-bio"><RichText text={about.bio} /></p>}
          {about.hobbies.length > 0 && <ul className="person-tags" aria-label="Free time">{about.hobbies.map((t) => <li key={t}><RichText text={t} /></li>)}</ul>}
        </div>
      )}

      {editing && (
        <form className="about-form" onSubmit={save}>
          <div className="field">
            <label htmlFor="about-bio">Bio</label>
            <div className="about-box">
              <textarea id="about-bio" ref={area} rows={4} value={bio} onChange={(e) => setBioChecked(e.target.value)} placeholder="e.g. Second-year bio major. Coffee, climbing and bad puns. Ask me about the lab." autoFocus />
              <div className="about-tools">
                <EmojiButton value={bio} onChange={setBioChecked} inputRef={area} max={BIO_MAX} />
                <span className={"count" + (bioLength(bio) > BIO_MAX * 0.9 ? " warn" : "")} aria-live="polite">{bioLength(bio)}/{BIO_MAX}</span>
              </div>
            </div>
          </div>

          <div className="field">
            <span id="about-free">What do you do in your free time?</span>
            <div className="onb-chips about-chips" role="group" aria-labelledby="about-free">
              {HOBBY_IDEAS.map((t) => <button key={t} type="button" aria-pressed={hobbies.some((x) => x.toLowerCase() === t.toLowerCase())} onClick={() => toggleIdea(t)}>{t}</button>)}
            </div>
            {hobbies.filter((t) => !HOBBY_IDEAS.some((i) => i.toLowerCase() === t.toLowerCase())).length > 0 && (
              <ul className="person-tags removable" aria-label="Your own">
                {hobbies.filter((t) => !HOBBY_IDEAS.some((i) => i.toLowerCase() === t.toLowerCase())).map((t) => <li key={t}>{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => setHobbies((l) => l.filter((x) => x !== t))}><X size={12} aria-hidden="true" /></button></li>)}
              </ul>
            )}
            <div className="about-add">
              <input aria-label="Add your own" value={tag} maxLength={HOBBY_LEN} placeholder={hobbies.length >= HOBBY_MAX ? `Up to ${HOBBY_MAX}` : "Something else? Type it and press Enter"} disabled={hobbies.length >= HOBBY_MAX}
                onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (tag.trim()) addTag(tag); } }} />
              <button type="button" className="btn" disabled={!tag.trim() || hobbies.length >= HOBBY_MAX} onClick={() => addTag(tag)}>Add</button>
            </div>
          </div>

          {error && <p className="error" role="alert">{error}</p>}
          <div className="about-actions">
            <button className="btn primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
