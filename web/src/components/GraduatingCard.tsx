import { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, X } from "lucide-react";
import { loadProfile } from "../lib/profile";

const KEY = (id: string) => `orbit-grad-card:${id}`;

/** Shown on Home to students in their last year: the school deletes their email after graduation, so this is the moment to keep the account and the connections.
 *  They can close it and it stays closed on this device. */
export default function GraduatingCard({ userId }: { userId: string }) {
  const [shut, setShut] = useState(() => { try { return localStorage.getItem(KEY(userId)) === "1"; } catch { return false; } });
  if (shut || !userId || loadProfile(userId)?.tenure !== "fourth-plus") return null;
  const close = () => { try { localStorage.setItem(KEY(userId), "1"); } catch { /* it still closes */ } setShut(true); };
  return (
    <section className="grad-card" aria-label="Graduating soon">
      <GraduationCap size={22} aria-hidden="true" />
      <div>
        <h2>Graduating soon?</h2>
        <p className="muted">Your school email will be deleted after you leave. Add a personal email so you keep your Orbit account and the people you met, and list yourself so students can reach you.</p>
        <div className="al-actions">
          <Link className="btn sm primary" to="/app/profile?tab=settings">Add a personal email</Link>
          <Link className="btn sm" to="/app/alumni">See the alumni list</Link>
        </div>
      </div>
      <button type="button" className="link-btn" aria-label="Close" onClick={close}><X size={16} aria-hidden="true" /></button>
    </section>
  );
}
