import { useEffect, useMemo, useState } from "react";
import Dropdown from "./Dropdown";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Search, UserPlus, X } from "lucide-react";
import PersonName from "./PersonName";
import Avatar from "./Avatar";
import RolesPanel from "./RolesPanel";
import { JoinRequests } from "./JoinPanel";
import { orgActions, type Org } from "../lib/campusOrgs";
import { buildPeople, sectionsOf, type Person } from "../lib/clubPeople";
import { RANK, outranks, rankLabel, rolesBelow } from "../lib/clubRoles";
import { searchPeople, type PersonHit } from "../lib/peopleSearch";
import { useAuth } from "../lib/auth";
import { notice } from "../lib/notice";

type Tab = "people" | "roles";

/** The club's people, in order: president, then each role from the top of the list down, then the team, then members. What you may do with someone
 *  depends on where you both stand: you can only act on people ranked below you, and give out roles below your own. The database enforces the same. */
export default function ClubMembers({ org, here, canRoles, canMembers, reviewer, onClose }: { org: Org; here: Set<string>; canRoles: boolean; canMembers: boolean; reviewer: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("people");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState("");
  const [asking, setAsking] = useState<{ id: string; what: "remove" | "president" } | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const mine = reviewer ? RANK.coordinator : org.myRank;
  const people = useMemo(() => buildPeople(org), [org.members, org.clubMembers]);
  const sections = useMemo(() => sectionsOf(people, q), [people, q]);
  const giveable = rolesBelow(mine, org.roles);
  const canAdd = canMembers || (canRoles && giveable.length > 0);
  const isOn = (p: Person) => here.has(p.id) || (p.self && here.size > 0);
  const showRoles = canRoles || org.roles.length > 0;

  const fail = (m: string | null) => { if (m) setError(m); else setError(""); return m; };

  const Row = (p: Person) => {
    const expanded = open === p.id;
    const above = p.rank !== RANK.president && outranks(mine, p.rank) && !p.self;
    const mayRole = canRoles && above && (giveable.length > 0 || p.rank < RANK.member);
    const mayRemove = (canMembers || canRoles) && above;
    const mayPresident = (org.owner || reviewer) && !p.self && p.rank !== RANK.president;
    const mayLeave = p.self && p.rank !== RANK.president;
    const any = mayRole || mayRemove || mayPresident || mayLeave;
    const on = isOn(p);
    const ask = asking?.id === p.id ? asking.what : null;
    return (
      <li key={p.id} className="cp-item">
        <div className="cp-row">
          <span className="cm-avw" aria-hidden="true"><Avatar name={p.name} id={p.id} size={32} />{on && <i className="cm-on" />}</span>
          <span className="cp-who"><span className="cm-name"><PersonName id={p.id} fallback={p.name} />{p.self && <span className="cp-you"> (you)</span>}</span>
            <span className="cp-sub">{rankLabel(p.rank, p.roleName)}{on ? " · online" : ""}</span></span>
          {any && <button type="button" className="cp-more" aria-label={`Actions for ${p.name}`} aria-expanded={expanded} onClick={() => { setOpen(expanded ? "" : p.id); setAsking(null); setError(""); }}><MoreHorizontal size={18} aria-hidden="true" /></button>}
        </div>
        {expanded && (
          <div className="cp-card">
            {!ask && (
              <>
                {mayRole && (
                  <div className="cp-field"><span>Role</span>
                    <Dropdown label={`Role for ${p.name}`} value={p.roleId ?? ""}
                      options={[
                        { value: "", label: p.rank < RANK.member ? "Member (no role)" : "Choose a role" },
                        ...(p.roleId && !giveable.some((r) => r.id === p.roleId) ? [{ value: p.roleId, label: p.roleName ?? "Role" }] : []),
                        ...giveable.map((r) => ({ value: r.id, label: r.name })),
                      ]}
                      onChange={async (v) => { if (v === (p.roleId ?? "")) return; if (!fail(await orgActions.setMemberRole(org.id, p.id, v || null))) notice.show({ icon: "calendar", title: v ? "Role changed" : "Now an ordinary member", message: `${p.name} has been told.`, ms: 2500 }); }} />
                  </div>
                )}
                <div className="cp-acts">
                  {mayPresident && <button type="button" className="link-btn" onClick={() => setAsking({ id: p.id, what: "president" })}>Make president</button>}
                  {mayRemove && <button type="button" className="link-btn danger" onClick={() => setAsking({ id: p.id, what: "remove" })}>Remove from club</button>}
                  {mayLeave && <button type="button" className="link-btn danger" onClick={async () => { if (!fail(await orgActions.removeMember(org.id, p.id))) nav("/app/campus"); }}>Leave club</button>}
                </div>
              </>
            )}
            {ask === "remove" && (
              <div className="cp-ask" role="group" aria-label="Confirm removal">
                <p>Remove {p.name} from {org.name}? They lose their role and can ask to join again.</p>
                <div className="cp-acts"><button type="button" className="btn sm danger" onClick={async () => { if (!fail(await orgActions.removeMember(org.id, p.id))) setOpen(""); setAsking(null); }}>Remove</button><button type="button" className="link-btn" onClick={() => setAsking(null)}>Cancel</button></div>
              </div>
            )}
            {ask === "president" && (
              <div className="cp-ask" role="group" aria-label="Confirm new president">
                <p>Make {p.name} the president of {org.name}? They will be able to do everything{org.owner ? ", and you will move down to the club's top role" : ""}.</p>
                <div className="cp-acts"><button type="button" className="btn sm primary" onClick={async () => { if (!fail(await orgActions.transferOwnership(org.id, p.id))) { setOpen(""); notice.show({ icon: "calendar", title: `${p.name} is the president`, message: "They have been told.", ms: 3500 }); } setAsking(null); }}>Make president</button><button type="button" className="link-btn" onClick={() => setAsking(null)}>Cancel</button></div>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <aside className="cmem-panel" aria-label="People">
      <header className="cm-head">
        <strong>People <span className="muted">{people.length}</span></strong>
        <button type="button" className="ac-icon" aria-label="Close people" onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </header>

      {showRoles && (
        <div className="cp-tabs" role="tablist" aria-label="People or roles">
          <button type="button" role="tab" aria-selected={tab === "people"} onClick={() => setTab("people")}>People</button>
          <button type="button" role="tab" aria-selected={tab === "roles"} onClick={() => setTab("roles")}>Roles{org.roles.length > 0 ? ` · ${org.roles.length}` : ""}</button>
        </div>
      )}

      {tab === "roles" && showRoles ? (
        <div className="cm-scroll"><RolesPanel org={org} reviewer={reviewer} embedded /></div>
      ) : (
        <>
          {canMembers && org.requests.length > 0 && <JoinRequests org={org} />}
          <label className="cm-search"><Search size={14} aria-hidden="true" /><input value={q} placeholder="Search people or roles" maxLength={40} aria-label="Search people" onChange={(e) => setQ(e.target.value)} /></label>
          {canAdd && !adding && <button type="button" className="btn sm cp-addbtn" onClick={() => setAdding(true)}><UserPlus size={15} aria-hidden="true" /> Add people</button>}
          {canAdd && adding && <AddPeople org={org} people={people} giveable={canRoles ? giveable : []} canMembers={canMembers} me={session?.user.id} onDone={() => setAdding(false)} />}
          {error && <p className="error" role="alert">{error}</p>}

          <div className="cm-scroll">
            {sections.map((s) => <section key={s.rank} className="cp-sec"><h4>{s.label} · {s.people.length}</h4><ul>{s.people.map(Row)}</ul></section>)}
            {sections.length === 0 && <p className="muted cm-none">No one matches.</p>}
            {org.memberCount > org.clubMembers.length && !q.trim() && <p className="muted cm-none">and {org.memberCount - org.clubMembers.length} more</p>}
          </div>
        </>
      )}
    </aside>
  );
}

/** Find a student by name or @username and bring them in: as a member, or straight onto the team with a role below yours. */
function AddPeople({ org, people, giveable, canMembers, me, onDone }: { org: Org; people: Person[]; giveable: Org["roles"]; canMembers: boolean; me?: string; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const inClub = new Set(people.map((p) => p.id));

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => { void searchPeople(q, me, 8).then((r) => { if (live) setHits(r); }); }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [q, me]);

  const choice = role || (canMembers ? "" : giveable[0]?.id ?? "");
  async function add(h: PersonHit) {
    setBusy(h.id); setError("");
    const err = await orgActions.addPerson(org.id, { id: h.id, name: h.name }, choice || null);
    setBusy("");
    if (err) { setError(err); return; }
    notice.show({ icon: "calendar", title: `${h.name} is in`, message: choice ? `They are ${giveable.find((r) => r.id === choice)?.name} now, and have been told.` : "They have been added as a member and told.", ms: 3500 });
    setQ("");
  }

  return (
    <section className="cp-add" aria-label="Add people">
      <div className="cp-add-top">
        <label className="cm-search"><Search size={14} aria-hidden="true" /><input autoFocus value={q} placeholder="Name or @username" maxLength={40} aria-label="Find a student to add" onChange={(e) => { setQ(e.target.value); setError(""); }} /></label>
        <button type="button" className="ac-icon" aria-label="Close add people" onClick={onDone}><X size={16} aria-hidden="true" /></button>
      </div>
      {(giveable.length > 0) && (
        <div className="cp-field"><span>Add them as</span>
          <Dropdown label="Add them as" value={choice} onChange={setRole} options={[...(canMembers ? [{ value: "", label: "Member" }] : []), ...giveable.map((r) => ({ value: r.id, label: r.name }))]} />
        </div>
      )}
      {q.trim().length >= 2 && hits.length === 0 && <p className="muted cm-none">No one on your campus matches.</p>}
      <ul className="cp-hits">
        {hits.map((h) => {
          const already = inClub.has(h.id);
          return (
            <li key={h.id} className="cp-hit">
              <Avatar name={h.name} id={h.id} size={32} />
              <span className="cp-who"><span className="cm-name">{h.name}</span><span className="cp-sub">{h.username ? `@${h.username}` : "Student"}</span></span>
              {already ? <span className="cp-sub">In the club</span> : <button type="button" className="btn sm" disabled={busy !== "" || (!choice && !canMembers)} onClick={() => void add(h)}>{busy === h.id ? "Adding…" : "Add"}</button>}
            </li>
          );
        })}
      </ul>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
