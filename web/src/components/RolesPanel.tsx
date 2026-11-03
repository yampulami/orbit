import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { orgActions, type Org } from "../lib/campusOrgs";
import { ALL_PERMS, OWNER_ONLY, PERMS, RANK, roleRank, type Perm } from "../lib/clubRoles";
import { notice } from "../lib/notice";

/** Roles to start from, for a club that has none yet. */
const STARTERS: { name: string; perms: Perm[] }[] = [
  { name: "Vice President", perms: ["announce", "events", "polls", "members", "tasks", "moderate", "channels"] },
  { name: "Treasurer", perms: ["announce", "events", "polls"] },
  { name: "Secretary", perms: ["announce", "polls", "tasks"] },
  { name: "Event lead", perms: ["announce", "events", "polls"] },
  { name: "Moderator", perms: ["moderate", "channels"] },
];

/** What the permissions are about, so a long list is easy to read. */
const GROUPS: { title: string; keys: Perm[] }[] = [
  { title: "People", keys: ["members", "roles"] },
  { title: "Posting", keys: ["announce", "polls", "moderate"] },
  { title: "Running the club", keys: ["events", "tasks", "channels"] },
];

/** The club's roles, in order: the one at the top has the most authority, and people can only manage those below them. The president makes the order;
 *  anyone allowed to manage roles can make and edit roles below their own, and give only powers they hold themselves. The database enforces it. */
export default function RolesPanel({ org, reviewer = false, embedded = false }: { org: Org; reviewer?: boolean; embedded?: boolean }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<Perm[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const mine = reviewer ? RANK.coordinator : org.myRank;
  const boss = org.owner || reviewer;
  const canMake = boss || org.myPerms.includes("roles");
  const held = (p: Perm) => boss || org.myPerms.includes(p);
  const mayEdit = (r: Org["roles"][number]) => boss || (canMake && roleRank(r) > mine);

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
  async function starter(s: (typeof STARTERS)[number]) {
    const err = await orgActions.saveRole(org.id, null, s.name, s.perms.filter(held));
    if (err) notice.show({ icon: "alert", title: "Could not make that role", message: err });
  }

  return (
    <section className={"club-section roles" + (embedded ? " roles-in" : "")} aria-label="Roles">
      {!embedded && <div className="cevents-top"><h2>Roles</h2></div>}
      <p className="muted rl-help">The role at the top has the most authority. People can only manage those below them, and can only give roles and powers they hold themselves.</p>

      <ul className="rl-list">
        <li className="rl-card rl-fixed">
          <div className="role-head"><strong>President</strong><span className="muted">{org.members.filter((m) => m.role === "owner").length} {org.members.filter((m) => m.role === "owner").length === 1 ? "person" : "people"}</span></div>
          <div className="role-perms"><span className="ev-flavor">Everything</span></div>
        </li>
        {org.roles.map((r, i) => (
          <li key={r.id} className="rl-card">
            <div className="role-head">
              <strong>{r.name}</strong><span className="muted">{r.people} {r.people === 1 ? "person" : "people"}</span>
              <span className="role-tools">
                {boss && <>
                  <button type="button" className="link-btn" aria-label={`Move ${r.name} up`} disabled={i === 0} onClick={() => void orgActions.moveRole(r.id, -1)}><ArrowUp size={15} aria-hidden="true" /></button>
                  <button type="button" className="link-btn" aria-label={`Move ${r.name} down`} disabled={i === org.roles.length - 1} onClick={() => void orgActions.moveRole(r.id, 1)}><ArrowDown size={15} aria-hidden="true" /></button>
                </>}
                {mayEdit(r) && <>
                  <button type="button" className="link-btn" aria-label={`Edit ${r.name}`} onClick={() => start(r.id)}><Pencil size={14} aria-hidden="true" /></button>
                  <button type="button" className="link-btn" aria-label={`Delete ${r.name}`} onClick={async () => { const err = await orgActions.deleteRole(r.id); if (err) notice.show({ icon: "alert", title: "Could not delete", message: err }); }}><Trash2 size={14} aria-hidden="true" /></button>
                </>}
              </span>
            </div>
            <div className="role-perms">{r.permissions.length === 0 ? <span className="muted">Title only, no extra powers</span> : r.permissions.map((p) => <span key={p} className="ev-flavor">{PERMS.find((x) => x.key === p)?.label}</span>)}</div>
          </li>
        ))}
        <li className="rl-card rl-fixed"><div className="role-head"><strong>Members</strong><span className="muted">everyone else</span></div><div className="role-perms"><span className="muted">Read the club's feed and chat, join in</span></div></li>
      </ul>

      {canMake && org.roles.length === 0 && editing === null && (
        <div className="rl-starters">
          <p className="muted">Start with a ready-made role, then change what it can do.</p>
          <div className="rl-starter-row">{STARTERS.map((s) => <button key={s.name} type="button" className="btn sm" onClick={() => void starter(s)}><Plus size={14} aria-hidden="true" /> {s.name}</button>)}</div>
        </div>
      )}
      {canMake && editing === null && <button type="button" className="btn rl-new" onClick={() => start("new")}><Plus size={15} aria-hidden="true" /> New role</button>}

      {editing !== null && (
        <form className="role-form" onSubmit={save}>
          <label className="field">Title<input autoFocus value={name} maxLength={30} placeholder="e.g. Treasurer" onChange={(e) => { setName(e.target.value); setError(""); }} /></label>
          {GROUPS.map((g) => (
            <fieldset key={g.title} className="role-checks">
              <legend>{g.title}</legend>
              {g.keys.filter((k) => ALL_PERMS.includes(k)).map((k) => {
                const p = PERMS.find((x) => x.key === k)!;
                const locked = (OWNER_ONLY.includes(p.key) && !boss) || !held(p.key);
                return (
                  <label key={p.key} className={"role-check" + (locked ? " locked" : "")}>
                    <input type="checkbox" checked={perms.includes(p.key)} disabled={locked} onChange={() => toggle(p.key)} />
                    <span><b>{p.label}</b><small>{locked ? (OWNER_ONLY.includes(p.key) ? "Only the president can hand this out." : "You can only give powers you have yourself.") : p.help}</small></span>
                  </label>
                );
              })}
            </fieldset>
          ))}
          {error && <p className="error" role="alert">{error}</p>}
          <div className="about-actions"><button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save role"}</button><button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button></div>
        </form>
      )}
    </section>
  );
}
