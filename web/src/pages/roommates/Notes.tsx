import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { removeWithUndo, roomActions, type Space } from "../../lib/roommates";

export default function Notes({ space }: { space: Space }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Give the note a title."); return; }
    roomActions.addNote(title.trim(), body.trim());
    setTitle(""); setBody(""); setError("");
  }

  return (
    <div className="rm-card">
      <form className="rm-add stack" data-tone="butter" onSubmit={add}>
        <label className="field"><span className="sr">Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiet hours, wifi password, who to call…" maxLength={60} /></label>
        <label className="field"><span className="sr">Details</span><textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details everyone should know" maxLength={400} /></label>
        <div className="rm-add-row"><button className="btn primary"><Plus size={18} aria-hidden="true" />Add note</button>{error && <p className="error" role="alert">{error}</p>}</div>
      </form>

      {space.notes.length === 0 ? (
        <p className="rm-empty">No notes yet. Keep quiet hours, expectations and reminders here.</p>
      ) : (
        <ul className="rm-notes">
          {space.notes.map((n) => (
            <li key={n.id}>
              <div><h3>{n.title}</h3>{n.body && <p>{n.body}</p>}</div>
              <button type="button" className="ghost-btn" aria-label={`Delete note ${n.title}`} onClick={() => removeWithUndo("notes", n.id, `“${n.title}”`)}><Trash2 size={16} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
