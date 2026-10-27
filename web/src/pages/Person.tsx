import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, MessageSquare, UserMinus, UserPlus, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { friendActions, useRelation } from "../lib/friends";
import { dmActions } from "../lib/dms";
import SafetyMenu from "../components/SafetyMenu";

type Profile = { name: string; username: string | null; tenure: string | null; interests: string[]; bio: string; hobbies: string[] };

const TENURE: Record<string, string> = {
  "first-semester": "First semester", "first-year": "First year", "second-year": "Second year",
  "third-year": "Third year", "fourth-plus": "Fourth year or longer", graduate: "Graduate student",
};

/** Another student's profile: who they are, and the button to become friends. Reached by tapping their name or picture anywhere. */
export default function Person() {
  const { id = "" } = useParams();
  const { session } = useAuth();
  const nav = useNavigate();
  const me = session?.user.id;
  const { relation, requestId } = useRelation(me, id);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);

  useEffect(() => {
    let alive = true;
    setProfile(undefined); setSure(false);
    if (!supabase) { setProfile(null); return; }
    Promise.resolve(supabase.from("student_profiles").select("display_name,username,tenure,interests,bio,hobbies").eq("user_id", id).maybeSingle()).then(({ data }) => {
      if (!alive) return;
      const r = data as { display_name: string; username: string | null; tenure: string | null; interests: string[] | null; bio: string | null; hobbies: string[] | null } | null;
      setProfile(r ? { name: r.display_name, username: r.username, tenure: r.tenure, interests: r.interests ?? [], bio: r.bio ?? "", hobbies: r.hobbies ?? [] } : null);
    }, () => { if (alive) setProfile(null); });
    return () => { alive = false; };
  }, [id]);

  async function act(job: () => Promise<boolean | void>) { setBusy(true); try { await job(); } finally { setBusy(false); } }

  if (profile === undefined) return <div className="page"><div className="skeleton sk-card" aria-busy="true" aria-label="Loading profile" /></div>;
  if (profile === null) {
    return (
      <div className="page">
        <h1 className="sr">Profile</h1>
        <div className="person-card"><h2>We could not find that student</h2><p className="muted">They may not be on your campus, or they have left Orbit.</p><Link to="/app/feed" className="btn">Back to Home</Link></div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="sr">{profile.name}</h1>
      <section className="person-card me-card">
        <span className="me big" aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</span>
        <div className="me-info">
          <div className="person-title"><h2>{profile.name}</h2><SafetyMenu userId={id} name={profile.name} context="profile" onBlocked={() => nav("/app/feed")} /></div>
          {profile.username && <p className="muted">@{profile.username}</p>}
          {profile.tenure && <p className="muted">{TENURE[profile.tenure] ?? profile.tenure}</p>}
          {profile.bio && <p className="about-bio">{profile.bio}</p>}
          {profile.hobbies.length > 0 && <><p className="person-sub">In their free time</p><ul className="person-tags" aria-label="Free time">{profile.hobbies.map((t) => <li key={t}>{t}</li>)}</ul></>}
          {profile.interests.length > 0 && <><p className="person-sub">Here for</p><ul className="person-tags" aria-label="Interests">{profile.interests.map((t) => <li key={t}>{t}</li>)}</ul></>}
          {!profile.bio && profile.hobbies.length === 0 && relation === "self" && <p className="muted">You have not added a bio yet. <Link to="/app/profile">Add one in your profile</Link>.</p>}

          <div className="person-actions">
            {relation === "self" && <Link to="/app/profile" className="btn">This is you. Edit your profile</Link>}
            {relation === "none" && <button type="button" className="btn primary" disabled={busy} onClick={() => act(async () => { const r = await friendActions.request(id); if (friendActions.tell(r.message, "Could not send the request")) return true; })}><UserPlus size={18} aria-hidden="true" />Add friend</button>}
            {relation === "outgoing" && (<>
              <button type="button" className="btn" disabled><Check size={18} aria-hidden="true" />Request sent</button>
              <button type="button" className="btn" disabled={busy} onClick={() => act(async () => { friendActions.tell(await friendActions.cancel(id), "Could not cancel"); })}>Cancel request</button>
            </>)}
            {relation === "incoming" && requestId && (<>
              <button type="button" className="btn primary" disabled={busy} onClick={() => act(async () => { friendActions.tell(await friendActions.accept(requestId), "Could not accept"); })}><Check size={18} aria-hidden="true" />Accept request</button>
              <button type="button" className="btn" disabled={busy} onClick={() => act(async () => { friendActions.tell(await friendActions.ignore(requestId), "Could not ignore"); })}><X size={18} aria-hidden="true" />Ignore</button>
            </>)}
            {relation === "friends" && (<>
              <button type="button" className="btn primary" disabled={busy} onClick={() => act(async () => { const t = await dmActions.start(id); if (t) nav("/app/messages", { state: { thread: t } }); })}><MessageSquare size={18} aria-hidden="true" />Message</button>
              {sure
                ? <button type="button" className="btn danger" disabled={busy} onClick={() => act(async () => { friendActions.tell(await friendActions.remove(id), "Could not unfriend"); setSure(false); })}>Yes, unfriend {profile.name}</button>
                : <button type="button" className="btn" onClick={() => setSure(true)}><UserMinus size={18} aria-hidden="true" />Friends</button>}
              {sure && <button type="button" className="btn" onClick={() => setSure(false)}>Keep as friends</button>}
            </>)}
          </div>
        </div>
      </section>
    </div>
  );
}
