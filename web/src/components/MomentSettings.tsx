import { Sparkles } from "lucide-react";
import { INTERESTS } from "../lib/moments";
import { momentActions, useMomentPrefs } from "../lib/momentPrefs";
import { useHang } from "../lib/hangouts";
import { haptic } from "../lib/haptics";

/** The switch and the choices for Orbit Moments. Off until the student turns it on; everything here stays on this device. */
export default function MomentSettings() {
  const prefs = useMomentPrefs();
  const { groups } = useHang();
  const hidden = prefs.hiddenCircles.map((id) => ({ id, name: groups.find((g) => g.id === id)?.name ?? "A group" }));
  const anyHidden = prefs.muted.length > 0 || hidden.length > 0 || prefs.dismissed.length > 0;
  return (
    <section className="moment-set" aria-label="Orbit Moments settings">
      <div className="ft-share">
        <div>
          <b id="mo-l"><Sparkles size={13} aria-hidden="true" /> Orbit Moments</b>
          <span>Suggest plans when your groups' schedules line up.</span>
        </div>
        <button type="button" role="switch" aria-checked={prefs.enabled} aria-labelledby="mo-l" className="switch" onClick={() => { haptic("select"); momentActions.setEnabled(!prefs.enabled); }}><span /></button>
      </div>
      {prefs.enabled && (
        <div className="ft-aud">
          <p className="muted mo-note">Only people in your groups who share their free time are counted. A suggestion is never sent for you: you look at it, edit it and confirm. These choices stay on this device.</p>
          <div className="sync-opt"><span id="mo-int">What you like</span>
            <div className="chip-row" role="group" aria-labelledby="mo-int">{INTERESTS.map((i) => <button key={i.id} type="button" className="chip-btn" aria-pressed={prefs.interests.includes(i.id)} onClick={() => momentActions.toggleInterest(i.id)}>{i.label}</button>)}</div>
          </div>
          {anyHidden && (
            <div className="mo-hidden">
              {prefs.muted.length > 0 && <p>Not suggesting: {prefs.muted.map((i) => INTERESTS.find((x) => x.id === i)?.label.toLowerCase()).join(", ")}</p>}
              {hidden.length > 0 && <p>Hidden groups: {hidden.map((h) => h.name).join(", ")}</p>}
              <button type="button" className="link-btn" onClick={() => momentActions.resetHidden()}>Show everything again</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
