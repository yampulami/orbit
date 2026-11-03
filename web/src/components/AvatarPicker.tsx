import { useEffect, useRef, useState } from "react";
import { Shuffle, Upload } from "lucide-react";
import Avatar from "./Avatar";
import { useAuth } from "../lib/auth";
import { COLOR_LABEL, COLOR_PARTS, OPTIONS, PARTS, PART_LABEL, SWATCHES, fromSpec, isPhoto, presets, randomCritter, saveMyAvatar, toSpec, useAvatarSpec, type ColorPart, type Critter, type Part } from "../lib/avatars";
import { discardImage, uploadImage } from "../lib/media";

const nice = (v: string) => v.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/** Pick your avatar: a ready-made critter, a critter you shape yourself (face parts and colours), your own photo, or just your initial. */
export default function AvatarPicker({ name }: { name: string }) {
  const { session } = useAuth();
  const uid = session?.user.id ?? "";
  const saved = useAvatarSpec(uid || undefined);
  const [spec, setSpec] = useState(saved);
  const [mode, setMode] = useState<"critter" | "photo">(isPhoto(saved) ? "photo" : "critter");
  const [part, setPart] = useState<Part>("eyes");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const touched = useRef(false);
  // The saved avatar can arrive after this opens.
  useEffect(() => { if (!touched.current) { setSpec(saved); setMode(isPhoto(saved) ? "photo" : "critter"); } }, [saved]);

  const critter = fromSpec(spec);
  const dirty = spec !== saved;
  const edit = (next: string) => { touched.current = true; setSpec(next); setMsg(""); };
  const patch = (k: Part | ColorPart, v: string | undefined) => edit(toSpec({ ...(critter ?? { seed: name || "orbit" }), [k]: v } as Critter));

  async function save() {
    if (!uid) { setMsg("Sign in to save your avatar."); return; }
    setBusy(true);
    const m = await saveMyAvatar(uid, spec);
    setBusy(false);
    if (m) setMsg(m); else { touched.current = false; setMsg("Saved."); }
  }
  async function photo(f: File) {
    setBusy(true); setMsg("");
    try {
      const old = isPhoto(spec) ? spec.slice(4) : "";
      const up = await uploadImage(f, uid || "guest", { side: 384, quality: 0.85, square: true });
      edit("img:" + up.path);
      if (old && old !== (isPhoto(saved) ? saved.slice(4) : "")) void discardImage(old);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Could not add the picture."); }
    finally { setBusy(false); }
  }

  return (
    <section className="avp" aria-label="Your picture">
      <h2>Your picture</h2>
      <div className="avp-top">
        <Avatar name={name} spec={spec} size={96} className="avp-big" />
        <div className="avp-modes" role="tablist" aria-label="Kind of picture">
          <button type="button" role="tab" aria-selected={mode === "critter"} onClick={() => { setMode("critter"); if (!critter) edit(presets()[0]); }}>Critter</button>
          <button type="button" role="tab" aria-selected={mode === "photo"} onClick={() => setMode("photo")}>Your photo</button>
          <button type="button" className="rm-link" onClick={() => edit("")}>Use my initial</button>
        </div>
      </div>

      {mode === "critter" ? (
        <>
          <ul className="avp-grid" aria-label="Ready-made critters">
            {presets().map((p) => (
              <li key={p}><button type="button" aria-pressed={spec === p} aria-label={`Critter ${fromSpec(p)?.seed}`} onClick={() => edit(p)}><Avatar name="" spec={p} size={52} /></button></li>
            ))}
          </ul>
          <div className="avp-shape">
            <div className="avp-bar">
              <b>Make it yours</b>
              <button type="button" className="rm-link" onClick={() => edit(toSpec(randomCritter()))}><Shuffle size={14} aria-hidden="true" /> Surprise me</button>
            </div>
            <div className="avp-parts" role="tablist" aria-label="Part to change">
              {PARTS.map((p) => <button key={p} type="button" role="tab" aria-selected={part === p} onClick={() => setPart(p)}>{PART_LABEL[p]}</button>)}
            </div>
            <ul className="avp-opts" aria-label={PART_LABEL[part]}>
              {OPTIONS[part].map((o) => (
                <li key={o}>
                  <button type="button" aria-pressed={critter?.[part] === o} aria-label={nice(o)} title={nice(o)} onClick={() => patch(part, o)}>
                    <Avatar name="" spec={toSpec({ ...(critter ?? { seed: name || "orbit" }), [part]: o })} size={44} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="avp-colors">
              {COLOR_PARTS.map((c) => (
                <div key={c} role="group" aria-label={COLOR_LABEL[c]}>
                  <span>{COLOR_LABEL[c]}</span>
                  <ul>
                    {SWATCHES[c].map((hex) => (
                      <li key={hex}><button type="button" aria-pressed={critter?.[c] === hex} aria-label={`${COLOR_LABEL[c]} #${hex}`} style={{ background: `#${hex}` }} onClick={() => patch(c, hex)} /></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="avp-photo">
          <p className="muted">A square picture works best. Orbit makes it small and keeps it private to your campus.</p>
          <button type="button" className="btn" disabled={busy} onClick={() => file.current?.click()}><Upload size={16} aria-hidden="true" /> {isPhoto(spec) ? "Choose a different photo" : "Choose a photo"}</button>
          <input ref={file} type="file" accept="image/*" className="sr" tabIndex={-1} aria-label="Choose a photo" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void photo(f); }} />
        </div>
      )}

      <div className="avp-save">
        <button type="button" className="btn primary" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save picture"}</button>
        {dirty && <button type="button" className="rm-link" onClick={() => { touched.current = false; setSpec(saved); setMsg(""); }}>Cancel</button>}
        {msg && <span className={msg === "Saved." ? "muted" : "error"} role="status">{msg}</span>}
      </div>
    </section>
  );
}
