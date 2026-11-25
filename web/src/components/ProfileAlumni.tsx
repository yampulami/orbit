import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AlumniAction from "./AlumniAction";
import { OPEN_LABEL, useAlumni } from "../lib/alumni";
import { useCampusOrgs } from "../lib/campusOrgs";
import { clubsByPerson } from "../lib/alumniClubs";
import { useAuth } from "../lib/auth";

/** On a graduate's profile: where they are now, what they will help with, and the way to ask. Nothing shows for anyone who is not listed.
 *  The profile already has their face, name, badge and clubs, so none of that is repeated. */
export default function ProfileAlumni({ id }: { id: string }) {
  if (!id) return null;
  return <Listed id={id} />;
}

function Listed({ id }: { id: string }) {
  const nav = useNavigate();
  const { session } = useAuth();
  const { list, reqs, ask } = useAlumni(session?.user.id);
  const { orgs } = useCampusOrgs();
  const shared = useMemo(() => (clubsByPerson(orgs).get(id) ?? []).filter((c) => c.mine).map((c) => c.name), [orgs, id]);
  const a = list.find((x) => x.id === id);
  if (!a) return null;
  const role = [a.jobTitle, a.industry].filter(Boolean).join(" · ");
  return (
    <section className="pv-alum" aria-labelledby="pv-alum-h">
      <h2 id="pv-alum-h">Where they are now</h2>
      <p className="pv-alum-where">{a.company || a.field || "Graduate"}</p>
      {role && <p className="pv-alum-role">{role}</p>}
      {a.field && a.company && <p className="pv-alum-role">Studied {a.field}</p>}
      {a.about && <p className="pv-alum-about">{a.about}</p>}
      {a.openTo.length > 0 && <p className="pv-alum-open">Open to {a.openTo.map((o) => OPEN_LABEL[o].toLowerCase()).join(", ")}</p>}
      {shared.length > 0 && <p className="al-req-shared">You are both in {shared.slice(0, 2).join(" and ")}</p>}
      <div className="al-actions"><AlumniAction person={a} reqs={reqs} shared={shared} ask={ask} seeRequests={() => nav("/app/alumni?tab=requests")} /></div>
    </section>
  );
}
