import { useCallback, useEffect, useState } from "react";
import { UserCheck, UserPlus, X } from "lucide-react";
import type { CampusEvent } from "../lib/campusEvents";
import { checkinActions, checkinOpen, checkinUrl, useAttendance } from "../lib/checkin";
import { supabase } from "../lib/supabase";

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** For the people running an event: a QR code that changes every 30 seconds, the six letters under it, who has checked in, and a way to check someone in by hand. */
export default function EventCheckin({ e }: { e: CampusEvent }) {
  const open = checkinOpen(e, new Date());
  const { rows, reload } = useAttendance(e.id, true);
  const [code, setCode] = useState("");
  const [left, setLeft] = useState(0);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  // Fetch the current code, show it, and fetch the next one just before it runs out.
  const refresh = useCallback(async () => {
    const r = await checkinActions.getCode(e.id);
    if ("error" in r) { setError(r.error); return null; }
    setError(""); setCode(r.code); setLeft(r.secondsLeft);
    try {
      const QR = await import("qrcode");
      setQr(await QR.toDataURL(checkinUrl(e.id, r.code), { margin: 1, width: 280, color: { dark: "#1a1613", light: "#ffffff" } }));
    } catch { setQr(""); }
    return r.secondsLeft;
  }, [e.id]);

  useEffect(() => {
    if (!open) return;
    let timer = 0, stopped = false;
    const loop = async () => { const s = await refresh(); if (!stopped) timer = window.setTimeout(loop, Math.max(2, (s ?? 10) - 1) * 1000); };
    void loop();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [open, refresh]);
  useEffect(() => { if (!open || !code) return; const t = window.setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000); return () => window.clearInterval(t); }, [open, code]);

  async function addByHand(ev: React.FormEvent) {
    ev.preventDefault();
    const err = await checkinActions.manualCheckIn(e.id, name);
    if (err) { setNote(err); return; }
    setName(""); setNote(""); void reload();
  }

  return (
    <div className="ci" aria-label={`Check-in for ${e.title}`}>
      {open ? (
        <div className="ci-qr">
          {qr ? <img src={qr} width={200} height={200} alt={`QR code to check in to ${e.title}. It changes every 30 seconds.`} /> : <div className="skeleton ci-skel" aria-busy="true" />}
          <div className="ci-code" aria-live="off"><span>Or type this code</span><b>{code ? `${code.slice(0, 3)} ${code.slice(3)}` : "······"}</b>
            <i className="ci-bar" aria-hidden="true"><u style={{ width: `${(left / 30) * 100}%` }} /></i>
            <small>The code changes every 30 seconds. Keep this screen up at the door.</small></div>
        </div>
      ) : <p className="muted">Check-in opens an hour before the event and closes an hour after it ends.</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <div className="ci-list">
        <h4><UserCheck size={14} aria-hidden="true" /> Checked in <span className="rem-count">{rows.length}</span></h4>
        {rows.length === 0 ? <p className="muted">Nobody yet.</p> : (
          <ul>{rows.map((r) => <li key={r.userId}><span>{r.name}</span><span className="muted">{clock(r.at)}{r.method === "manual" ? " · by hand" : ""}</span><button type="button" className="link-btn" aria-label={`Undo check-in for ${r.name}`} onClick={async () => { await checkinActions.remove(e.id, r.userId); void reload(); }}><X size={12} aria-hidden="true" /></button></li>)}</ul>
        )}
        {supabase && (
          <form className="ci-hand" onSubmit={addByHand}>
            <label className="sr" htmlFor={`ci-${e.id}`}>Username to check in by hand</label>
            <input id={`ci-${e.id}`} value={name} maxLength={40} placeholder="Check someone in by username" onChange={(x) => { setName(x.target.value); setNote(""); }} />
            <button className="btn" disabled={!name.trim()}><UserPlus size={14} aria-hidden="true" /> Check in</button>
          </form>
        )}
        {note && <p className="error" role="alert">{note}</p>}
      </div>
    </div>
  );
}

