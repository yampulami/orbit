import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus, X } from "lucide-react";
import { orgActions, type Org } from "../lib/campusOrgs";
import { JoinRequests } from "./JoinPanel";

const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

type Person = { id: string; name: string; group: string; title?: string; owner: boolean; roleId?: string; self: boolean };

/** The members panel: who is online, then who is not, grouped by role, with counts. Tap a person to see what you can do with them. */
export default function ClubMembers({ org, here, canRoles, canMembers, onClose }: { org: Org; here: Set<string>; canRoles: boolean; canMembers: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState("");
  const [username, setUsername] = useState("");
  const [roleFor, setRoleFor] = useState("");
  const [error, setError] = useState("");

  const people: Person[] = useMemo(() => {
    const team: Person[] = org.members.map((m) => ({ id: m.id, name: m.name, group: m.role === "owner" ? "President" : m.title ?? "Officers", title: m.title, owner: m.role === "owner", roleId: m.roleId, self: m.name === "You" }));
    const teamIds = new Set(team.map((p) => p.id));
    const rest: Person[] = org.clubMembers.filter((m) => !teamIds.has(m.id)).map((m) => ({ id: m.id, name: m.name, group: "Members", owner: false, self: m.name === "You" }));
    return [...team, ...rest];
  }, [org.members, org.clubMembers]);

  const needle = q.trim().toLowerCase();
  const shown = people.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.group.toLowerCase().includes(needle));
  const isOn = (p: Person) => here.has(p.id) || (p.self && here.size > 0);
  const online = shown.filter(isOn), offline = shown.filter((p) => !isOn(p));

  const sections = (list: Person[]) => {
    const order: string[] = [];
    for (const p of list) if (!order.includes(p.group)) order.push(p.group);
    order.sort((a, b) => rank(a) - rank(b));
    return order.map((g) => ({ g, items: list.filter((p) => p.group === g) }));
  };
  const rank = (g: string) => (g === "President" ? 0 : g === "Members" ? 2 : 1);

  async function add(e: FormEvent) {
    e.preventDefault();
    const r = await orgActions.addMember(org.id, username, roleFor || undefined);
    if (r) { setError(r); return; }
    setUsername("");
  }

  const Row = (p: Person) => {
    const on = isOn(p);
    const expanded = open === p.id;
    return (
      <li key={p.id} className="cm-item">
        <button type="button" className="cm-row" aria-expanded={expanded} data-off={on ? undefined : ""} onClick={() => setOpen(expanded ? "" : p.id)}>
          <span className="cm-av" aria-hidden="true">{initials(p.name)}{on && <i className="cm-on" />}</span>
          <span className="cm-name">{p.name}</span>
          {p.title && <span className="cf-title-chip">{p.title}</span>}
        </button>
        {expanded && (
          <div className="cm-card">
            <p className="muted">{p.owner ? "President" : p.title ?? (p.group === "Members" ? "Member" : "Officer")} Â· {on ? "online now" : "offline"}</p>
            <div className="cm-actions">
              {canRoles && !p.owner && p.group !== "Members" && org.roles.length > 0 && (
                <select className="role-pick" aria-label={`Role for ${p.name}`} value={p.roleId ?? ""} onChange={(e) => e.target.value && void orgActions.setMemberRole(org.id, p.id, e.target.value)}>
                  <option value="">{p.roleId ? "" : "Choose role"}</option>{org.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}
              {canRoles && !p.owner && !p.self && <button type="button" className="link-btn" onClick={() => void orgActions.removeMember(org.id, p.id)}>Remove</button>}
              {p.self && !p.owner && <button type="button" className="link-btn" onClick={async () => { await orgActions.removeMember(org.id, p.id); nav("/app/campus"); }}>Leave</button>}
              {!canRoles && !p.self && <span className="muted">Nothing to manage here.</span>}
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <aside className="cmem-panel" aria-label="Members">
      <header className="cm-head">
        <strong>Members <span className="muted">{people.length}</span></strong>
        <button type="button" className="ac-icon" aria-label="Close members" onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </header>
      <label className="cm-search"><Search size={14} aria-hidden="true" /><input value={q} placeholder="Search" maxLength={40} aria-label="Search members" onChange={(e) => setQ(e.target.value)} /></label>

      {canMembers && org.requests.length > 0 && <JoinRequests org={org} />}

      <div className="cm-scroll">
        {online.length > 0 && <h3 className="cm-label">Online Â· {online.length}</h3>}
        {sections(online).map((s) => <section key={"on" + s.g}><h4>{s.g} Â· {s.items.length}</h4><ul>{s.items.map(Row)}</ul></section>)}
        {offline.length > 0 && <h3 className="cm-label">Offline Â· {offline.length}</h3>}
        {sections(offline).map((s) => <section key={"off" + s.g}><h4>{s.g} Â· {s.items.length}</h4><ul>{s.items.map(Row)}</ul></section>)}
        {shown.length === 0 && <p className="muted cm-none">No one matches.</p>}
        {org.memberCount > org.clubMembers.length && !needle && <p className="muted cm-none">and {org.memberCount - org.clubMembers.length} more</p>}
      </div>

      {canRoles && (
        <form className="cm-add" onSubmit={add}>
          <label className="sr" htmlFor="cm-add-user">Username of the person to add</label>
          <input id="cm-add-user" value={username} maxLength={40} placeholder="Add by username" onChange={(e) => { setUsername(e.target.value); setError(""); }} />
          {org.roles.length > 0 && <select className="role-pick" aria-label="Role" value={roleFor} onChange={(e) => setRoleFor(e.target.value)}><option value="">No role</option>{org.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}
          <button className="btn sm" disabled={!username.trim()}><UserPlus size={14} aria-hidden="true" /> Add</button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </aside>
  );
}
