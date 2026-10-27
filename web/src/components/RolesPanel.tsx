import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { orgActions, type Org } from "../lib/campusOrgs";
import { OWNER_ONLY, PERMS, type Perm } from "../lib/clubRoles";
import { notice } from "../lib/notice";

/** The club's roles: a title and a set of things that title can do, like Discord. The owner (and anyone allowed to manage roles) makes them and gives
 *  them to people; the database enforces what each role may do. */
export default function RolesPanel({ org }: { org: Org }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<Perm[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const start = (id: string | "new") => {
    const r = org.roles.find((x) => x.id === id);
    setEditing(id); setName(r?.name ?? ""); setPerms(r?.permissions ?? ["announce"]); setError("");
  };
  const toggle = (p: Perm) => setPerms((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await orgActions.saveRole(org.id, editing === "new" ? null : editing, name, perms);
    setBusy(false);
    if (err) { setError(err); return; }
    notice.show({ icon: "calendar", title: editing === "new" ? "Role created" : "Role saved", message: "People with this role can do what you ticked.", ms: 3000 });
    setEditing(null);
  }

  return (
    <section className="club-section roles" aria-label="Roles">
      <div className="cevents-top"><h2>Roles</h2>{editing === null && <button type="button" className="btn" onClick={() => start("new")}><Plus size={15} aria-hidden="true" /> New role</button>}</div>
      <p className="muted">Give people a title and decide what it lets them do. The president can always do everything.</p>

      {org.roles.length === 0 && editing === null && <p className="muted">No roles yet. Make one, like Treasurer or Event lead, then give it to someone on your team.</p>}
      <ul className="role-list">
        {org.roles.map((r) => (
          <li key={r.id} className="role-card">
            <div className="role-head"><strong>{r.name}</strong><span className="muted">{r.people} {r.people === 1 ? "person" : "people"}</span>
              <span className="role-tools"><button type="button" className="link-btn" aria-label={`Edit ${r.name}`} onClick={() => start(r.id)}><Pencil size={13} aria-hidden="true" /></button>
                <button type="button" className="link-btn" aria-label={`Delete ${r.name}`} onClick={async () => { const err = await orgActions.deleteRole(r.id); if (err) notice.show({ icon: "alert", title: "Could not delete", message: err }); }}><Trash2 size={13} aria-hidden="true" /></button></span></div>
            <div className="role-perms">{r.permissions.length === 0 ? <span className="muted">Title only, no extra powers</span> : r.permissions.map((p) => <span key={p} className="ev-flavor">{PERMS.find((x) => x.key === p)?.label}</span>)}</div>
          </li>
        ))}
      </ul>

      {editing !== null && (
        <form className="role-form" onSubmit={save}>
          <label className="field">Title<input autoFocus value={name} maxLength={30} placeholder="e.g. Treasurer" onChange={(e) => { setName(e.target.value); setError(""); }} /></label>
          <fieldset className="role-checks">
            <legend>What can this role do?</legend>
            {PERMS.map((p) => {
              const locked = OWNER_ONLY.includes(p.key) && !org.owner;
              return (
                <label key={p.key} className={"role-check" + (locked ? " locked" : "")}>
                  <input type="checkbox" checked={perms.includes(p.key)} disabled={locked} onChange={() => toggle(p.key)} />
                  <span><b>{p.label}</b><small>{locked ? "Only the president can hand this out." : p.help}</small></span>
                </label>
              );
            })}
          </fieldset>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="about-actions"><button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save role"}</button><button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button></div>
        </form>
      )}
    </section>
  );
}
