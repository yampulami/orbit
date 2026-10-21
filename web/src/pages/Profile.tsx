import { Flame, LogOut } from "lucide-react";
import { disableDeviceAlerts, enableDeviceAlerts, useDeviceAlerts } from "../lib/deviceAlerts";
import { setNudge, useNudges } from "../lib/nudges";
import { notice } from "../lib/notice";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BadgeIcon from "../components/BadgeIcon";
import { ThemeSegment } from "../components/ThemeControls";
import { useAuth } from "../lib/auth";
import { badges, earnedIds, progress, streakWeeks, useProgress, type Area } from "../lib/progress";

const AREAS: Area[] = ["Feed", "Groups", "Hangouts", "Everywhere"];

export default function Profile() {
  const { session, signOut } = useAuth();
  const email = session?.user.email;
  const name = (session?.user.user_metadata?.name as string | undefined) || email?.split("@")[0] || "Student";
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
        <div><h2>{name}</h2>{email && <p className="muted">{email}</p>}</div>
      </section>

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
          <span id="n-device">Alert me on this device while Orbit is open in another tab</span>
          <button type="button" role="switch" aria-checked={device.on} aria-labelledby="n-device" className="switch" onClick={toggleDevice} disabled={!device.supported}><span /></button>
        </div>
        <p className="muted notif-note">Alerts only reach you while Orbit is open in a tab or window. Alerts when Orbit is closed need a notification server, which is not set up yet.</p>
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
        <button type="button" className="btn" onClick={async () => { await signOut(); nav("/login", { replace: true }); }}><LogOut size={18} strokeWidth={1.9} aria-hidden="true" />Sign out</button>
      </section>
    </div>
  );
}
