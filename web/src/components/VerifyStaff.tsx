import { useEffect, useState } from "react";
import { BadgeCheck, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { isPersonalEmail, requestStaffReview, verifyStaff, type VerifyResult } from "../lib/staffClaims";
import { bindCampusEvents, unbindCampusEvents } from "../lib/campusEvents";
import { notice } from "../lib/notice";

/** The page staff are sent to: prove you run student life at your school, from a page on the school's own website. Nothing to wait for: the page is read
 *  on the spot, and when it does not settle it you can ask your campus's coordinators. */
export default function VerifyStaff({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
  const email = session?.user.email ?? "";
  const uid = session?.user.id;
  const personal = !!email && isPersonalEmail(email);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"" | "check" | "ask">("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [asked, setAsked] = useState(false);
  const [askError, setAskError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy("check"); setResult(null); setAsked(false); setAskError("");
    const r = await verifyStaff(url.trim());
    setBusy("");
    setResult(r);
    if (r.ok && uid) {
      // The role is theirs now: load the campus again so the Review tools appear.
      unbindCampusEvents(); bindCampusEvents(uid);
      notice.show({ icon: "calendar", title: `You are ${r.role === "coordinator" ? "a coordinator" : "staff"}`, message: "The Review tools are on the Campus tab now.", ms: 5000 });
    }
  }
  async function ask() {
    setBusy("ask"); setAskError("");
    const err = await requestStaffReview(url.trim(), result?.title ?? "");
    setBusy("");
    if (err) setAskError(err); else setAsked(true);
  }

  const canAsk = result && !result.ok && ["weak_title", "wrong_office", "not_official", "ambiguous", "not_found", "needs_approval", "unreadable"].includes(result.code ?? "");

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal cinfo vs" role="dialog" aria-modal="true" aria-label="Verify your staff role">
        <header className="cinfo-head">
          <h2 className="cinfo-title">Verify your staff role</h2>
          <button type="button" className="ac-icon" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>

        {result?.ok ? (
          <div className="vs-done" role="status">
            <p className="vs-ok"><BadgeCheck size={18} aria-hidden="true" /> {result.already ? "You already have access." : `Verified. You are ${result.role === "coordinator" ? "a coordinator" : "staff"}${result.title ? `, ${result.title}` : ""}.`}</p>
            <p className="muted">Open the Review tab on Campus to approve clubs and events. The people on your team and any access requests are there too.</p>
            <button type="button" className="btn primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <p className="vs-lead">Run student life at your school? Orbit confirms it from your school's own website, so there is nobody to wait for.</p>
            <ol className="vs-steps">
              <li><b>Sign in with your school email.</b> You are signed in as <span className="vs-email">{email || "no one"}</span>.{personal && <span className="error" role="alert"> That is a personal address. Sign out and sign in with your school email to verify.</span>}</li>
              <li><b>Find your page.</b> Open your school's staff directory (or your office's page) and copy the link to the page that shows your name, your title and your school email.</li>
              <li><b>Paste it here.</b> It has to be on your school's main website. Orbit reads it and checks that it is you and that you hold a leadership title in a student-life office, like Dean of Students or Director of Student Engagement.</li>
            </ol>
            <form className="vs-form" onSubmit={check}>
              <label className="field">Link to your page
                <input type="url" inputMode="url" value={url} maxLength={400} placeholder="https://www.yourschool.edu/staff/your-name" onChange={(e) => { setUrl(e.target.value); setResult(null); }} />
              </label>
              <button className="btn primary" disabled={!url.trim() || busy !== "" || personal}>{busy === "check" ? "Checking…" : "Verify"}</button>
            </form>

            {result && !result.ok && (
              <div className="vs-fail" role="alert">
                <p><b>That did not verify.</b> {result.reason}</p>
                {canAsk && !asked && (
                  <>
                    <p className="muted">If the page is right, you can ask the coordinators at your campus to approve you instead.{result.code === "needs_approval" ? "" : " If your campus does not have one yet, try another page from your school's website."}</p>
                    <button type="button" className="btn" disabled={busy !== ""} onClick={() => void ask()}>{busy === "ask" ? "Sending…" : "Ask a coordinator to decide"}</button>
                  </>
                )}
                {asked && <p className="vs-ok">Sent. The coordinators at your campus were told, and you will get a notification when they decide.</p>}
                {askError && <p className="error" role="alert">{askError}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
