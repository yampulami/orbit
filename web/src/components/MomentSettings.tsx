import { Sparkles } from "lucide-react";
import { INTERESTS } from "../lib/moments";
import { momentActions, useMomentPrefs } from "../lib/momentPrefs";
import { useHang } from "../lib/hangouts";
import { haptic } from "../lib/haptics";

/** The choices for Orbit Moments. Off until the student turns it on; where the suggestions show is a separate choice; everything stays on this device. */
export default function MomentSettings() {
  const prefs = useMomentPrefs();
  const { groups } = useHang();
  const hidden = prefs.hiddenCircles.map((id) => ({ id, name: groups.find((g) => g.id === id)?.name ?? "A group" }));
  const anyHidden = prefs.muted.length > 0 || hidden.length > 0 || prefs.dismissed.length > 0;
  const flip = (fn: () => void) => () => { haptic("select"); fn(); };
  return (
    <section className="moment-set" aria-label="Orbit Moments settings">
      <div className="ft-share">
        <div>
          <b id="mo-l"><Sparkles size={13} aria-hidden="true" /> Orbit Moments</b>
          <span>Look for times your groups are free together.</span>
        </div>
        <button type="button" role="switch" aria-checked={prefs.enabled} aria-labelledby="mo-l" className="switch" onClick={flip(() => momentActions.setEnabled(!prefs.enabled))}><span /></button>
      </div>
      {prefs.enabled && (
        <>
          <div className="ft-share">
            <div>
              <b id="mo-f">Show on the feed</b>
              <span>One folded line. Always here and in group chats.</span>
            </div>
            <button type="button" role="switch" aria-checked={prefs.showOnFeed} aria-labelledby="mo-f" className="switch" onClick={flip(() => momentActions.setShowOnFeed(!prefs.showOnFeed))}><span /></button>
          </div>
          <div className="mo-like">
            <span id="mo-int">I would say yes to <small>{prefs.interests.length ? `${prefs.interests.length} picked` : "pick any"}</small></span>
            <div className="mo-grid" role="group" aria-labelledby="mo-int">
              {INTERESTS.map((i) => <button key={i.id} type="button" aria-pressed={prefs.interests.includes(i.id)} onClick={() => momentActions.toggleInterest(i.id)}>{i.label}</button>)}
            </div>
          </div>
          <p className="muted mo-note">Only people in your groups who share their free time are counted. Nothing is sent without your OK. These choices stay on this device.</p>
          {anyHidden && (
            <div className="mo-hidden">
              {prefs.muted.length > 0 && <p>Not suggesting: {prefs.muted.map((i) => INTERESTS.find((x) => x.id === i)?.label.toLowerCase()).join(", ")}</p>}
              {hidden.length > 0 && <p>Hidden groups: {hidden.map((h) => h.name).join(", ")}</p>}
              <button type="button" className="link-btn" onClick={() => momentActions.resetHidden()}>Show everything again</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
