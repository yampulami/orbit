import { useEffect, useState, type FormEvent } from "react";
import { Flame, LogOut, Pencil, Trash2 } from "lucide-react";
import { NAME_MAX, renameMe, useDisplayName } from "../lib/displayName";
import { pushSupported } from "../lib/push";
import { disableDeviceAlerts, enableDeviceAlerts, useDeviceAlerts } from "../lib/deviceAlerts";
import { setNudge, useNudges } from "../lib/nudges";
import { notice } from "../lib/notice";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BadgeIcon from "../components/BadgeIcon";
import { ThemeSegment } from "../components/ThemeControls";
import { useAuth } from "../lib/auth";
import { isGuestEmail } from "../lib/demoAuth";
import { checkUsername, normalizeUsername, saveUsername, suggestUsername, USERNAME_MAX } from "../lib/username";
import { badges, earnedIds, progress, streakWeeks, useProgress, type Area } from "../lib/progress";

const AREAS: Area[] = ["Feed", "Groups", "Hangouts", "Everywhere"];

export default function Profile() {
  const { session, signOut, deleteAccount, refresh } = useAuth();
  const isGuest = !!(session?.user as { is_anonymous?: boolean } | undefined)?.is_anonymous || isGuestEmail(session?.user.email);
  const [deleting, setDeleting] = useState<"idle" | "asking" | "working">("idle");
  const [deleteError, setDeleteError] = useState("");

  // Your username: how friends find you and add you to groups. Unique on your campus.
  const [username, setUsernameValue] = useState<string | null | undefined>(undefined); // undefined while loading
  const [editingUser, setEditingUser] = useState(false);
  const [userDraft, setUserDraft] = useState("");
  const [userError, setUserError] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  useEffect(() => {
    if (!supabase || !session) return;
    let alive = true;
    Promise.resolve(supabase.from("student_profiles").select("username").eq("user_id", session.user.id).maybeSingle()).then(({ data }) => { if (alive) setUsernameValue((data as { username: string | null } | null)?.username ?? null); }, () => { if (alive) setUsernameValue(null); });
    return () => { alive = false; };
  }, [session]);

  async function submitUsername(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSavingUser(true);
    const problem = await saveUsername(session.user.id, userDraft);
    setSavingUser(false);
    if (problem) { setUserError(problem); return; }
    setUsernameValue(normalizeUsername(userDraft));
    setEditingUser(false); setUserError("");
    notice.show({ icon: "pin", title: "Username saved", message: `Friends can find you as @${normalizeUsername(userDraft)}.`, ms: 3500 });
  }
  const email = session?.user.email;
  const name = useDisplayName();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const problem = await renameMe(session, draft);
    setSaving(false);
    if (problem) { setNameError(problem); return; }
    refresh();
    setEditing(false); setNameError("");
    notice.show({ icon: "pin", title: "Name updated", message: "This is how you show up to everyone now.", ms: 3500 });
  }
  const nav = useNavigate();
  const p = useProgress();
  const earned = earnedIds(p);
  const weeks = streakWeeks(p);
  const nudges = useNudges(session?.user.id);
  const device = useDeviceAlerts();
  const uid = session?.user.id;

  async function toggleDevice() {
    if (device.on) { disableDeviceAlerts(); return; }
    const r = await enableDeviceAlerts();
    if (r === "denied") notice.show({ icon: "alert", title: "Alerts are blocked", message: "Your browser is blocking notifications from Orbit. Allow them in the site settings next to the address bar, then try again." });
    else if (r === "unsupported") notice.show({ icon: "alert", title: "Not available here", message: "This browser can't show device alerts. The bell in the top bar still shows everything that needs you." });
  }

  return (
    <div className="page">
      <h1 className="sr">Profile</h1>
      <section className="me-card">
        <span className="me big" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        <div className="me-info">
          {editing ? (
            <form className="name-edit" onSubmit={saveName}>
              <label className="sr" htmlFor="name-edit">Your name</label>
              <input id="name-edit" autoFocus value={draft} maxLength={NAME_MAX} onChange={(e) => setDraft(e.target.value)} placeholder="Your name" />
              <button className="btn primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              <button type="button" className="btn" onClick={() => { setEditing(false); setNameError(""); }}>Cancel</button>
              {nameError && <p className="error" role="alert">{nameError}</p>}
            </form>
          ) : (
            <>
              <h2>{name}</h2>
              {email && <p className="muted">{email}</p>}
              <button type="button" className="btn" onClick={() => { setDraft(name); setEditing(true); }}><Pencil size={16} aria-hidden="true" />Edit name</button>
            </>
          )}
        </div>
      </section>

      {supabase && username !== undefined && (
        <section className="track username-card" aria-label="Username">
          <div>
            <h2>Username</h2>
            {editingUser ? (
              <form className="name-edit" onSubmit={submitUsername}>
                <label className="sr" htmlFor="username-edit">Username</label>
                <span className="onb-at"><span aria-hidden="true">@</span><input id="username-edit" autoFocus value={userDraft} maxLength={USERNAME_MAX} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setUserDraft(normalizeUsername(e.target.value).replace(/[^a-z0-9_]/g, ""))} placeholder="username" /></span>
                <button className="btn primary" disabled={savingUser || !!checkUsername(userDraft)}>{savingUser ? "Saving…" : "Save"}</button>
                <button type="button" className="btn" onClick={() => { setEditingUser(false); setUserError(""); }}>Cancel</button>
                <p className={userError || (userDraft && checkUsername(userDraft)) ? "error" : "muted"} role={userError ? "alert" : undefined}>{userError || (userDraft && checkUsername(userDraft)) || "Letters, numbers and underscores. Nobody else on your campus can have the same one."}</p>
              </form>
            ) : username ? (
              <p className="muted">@{username}. Friends use this to find you and add you to groups.</p>
            ) : (
              <p className="muted">You have not chosen one yet. Friends use it to find you and add you to groups.</p>
            )}
          </div>
          {!editingUser && <button type="button" className="btn" onClick={() => { setUserDraft(username ?? suggestUsername(name.split(" ")[0] ?? "")); setUserError(""); setEditingUser(true); }}><Pencil size={16} aria-hidden="true" />{username ? "Change" : "Choose username"}</button>}
        </section>
      )}

      <section className="track">
        <div>
          <h2>Appearance</h2>
          <p className="muted">Light, dark, or match your device.</p>
        </div>
        <ThemeSegment />
      </section>

      <section className="notif-card" aria-label="Notifications">
        <div>
          <h2>Notifications</h2>
          <p className="muted">The bell in the top bar collects what needs you. Choose what it includes.</p>
        </div>
        {([["hangouts", "Hangouts waiting for your answer"], ["reminders", "Reminders when they are due"], ["places", "Places on the map waiting for a vote"]] as const).map(([k, label]) => (
          <div className="notif-row" key={k}>
            <span id={`n-${k}`}>{label}</span>
            <button type="button" role="switch" aria-checked={nudges[k]} aria-labelledby={`n-${k}`} className="switch" onClick={() => uid && setNudge(uid, k, !nudges[k])}><span /></button>
          </div>
        ))}
        <div className="notif-row">
          <span id="n-device">Alert me on this device</span>
          <button type="button" role="switch" aria-checked={device.on} aria-labelledby="n-device" className="switch" onClick={toggleDevice} disabled={!device.supported}><span /></button>
        </div>
        <p className="muted notif-note">{pushSupported() ? "Reminders and hangouts about to start reach this device even when Orbit is closed. On iPhone, add Orbit to your Home Screen first." : "Alerts only reach you while Orbit is open in a tab or window."}</p>
      </section>

      <section className="track">
        <div>
          <h2>Track my streak and badges</h2>
          <p className="muted">Counts the weeks you post, reply, plan or join something. No points, no rankings. Saved on this device only.</p>
        </div>
        <button type="button" role="switch" aria-checked={p.enabled} aria-label="Track my streak and badges" className="switch" onClick={() => progress.setEnabled(!p.enabled)}><span /></button>
      </section>

      {p.enabled && (
        <section className="orbit-you" aria-label="Your Orbit">
          <h2>Your Orbit</h2>
          <div className="streak-card">
            <span className="streak-flame" aria-hidden="true"><Flame size={28} strokeWidth={1.75} /></span>
            <div>
              <strong>{weeks === 0 ? "No active weeks yet" : `${weeks} active week${weeks === 1 ? "" : "s"} in a row`}</strong>
              <p>A week counts when you post, reply, plan a hangout, say Yes, or check in.</p>
            </div>
          </div>
          {earned.length === 0 ? (
            <p className="muted">Badges show up here as you go.</p>
          ) : (
            AREAS.map((a) => {
              const list = badges.filter((b) => b.area === a && earned.includes(b.id));
              return list.length === 0 ? null : (
                <div key={a} className="badge-area">
                  <h3>{a}</h3>
                  <ul>
                    {list.map((b) => (
                      <li key={b.id}><BadgeIcon icon={b.icon} area={b.area} /><strong>{b.name}</strong><span>{b.hint}</span></li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </section>
      )}

      <section className="signout">
        <button type="button" className="btn" onClick={async () => { await signOut(); nav("/login", { replace: true }); }}><LogOut size={18} strokeWidth={1.9} aria-hidden="true" />{isGuest ? "Sign out and delete this guest" : "Sign out"}</button>
        {isGuest && <p className="muted">You are using a guest account. Guests cannot sign back in, so signing out removes it and everything you made.</p>}
      </section>

      <section className="danger-zone" aria-label="Delete account">
        {deleting === "idle" ? (
          <button type="button" className="btn danger" onClick={() => { setDeleting("asking"); setDeleteError(""); }}><Trash2 size={18} strokeWidth={1.9} aria-hidden="true" />Delete my account</button>
        ) : (
          <div className="danger-confirm" role="alertdialog" aria-labelledby="del-title" aria-describedby="del-text">
            <h2 id="del-title">Delete your account?</h2>
            <p id="del-text" className="muted">This removes your profile and everything you made: your messages, plans, chores and reminders. It cannot be undone. Groups you started stay with the friends who are still in them.</p>
            {deleteError && <p className="error" role="alert">{deleteError}</p>}
            <div className="danger-actions">
              <button type="button" className="btn danger" disabled={deleting === "working"} onClick={async () => {
                setDeleting("working");
                const problem = await deleteAccount();
                if (problem) { setDeleteError(problem); setDeleting("asking"); return; }
                nav("/login", { replace: true });
              }}>{deleting === "working" ? "Deleting…" : "Yes, delete everything"}</button>
              <button type="button" className="btn" disabled={deleting === "working"} onClick={() => setDeleting("idle")}>Keep my account</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
