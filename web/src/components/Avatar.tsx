import { critterUri, isPhoto, photoPath, useAvatarSpec } from "../lib/avatars";
import { useMediaUrl } from "../lib/media";
import { gradientFor } from "../lib/look";

/** A person's round face: their critter or photo if they picked one, otherwise their first letter. Pass `id` to look up their avatar,
 *  or `spec` when you already have it (for example your own, while you are choosing). */
export default function Avatar({ name, id, spec, size = 32, className = "" }: { name: string; id?: string; spec?: string; size?: number; className?: string }) {
  const s = useAvatarSpec(id, spec);
  const photo = isPhoto(s) ? photoPath(s) : null;
  const url = useMediaUrl(photo);
  const src = photo ? (url || null) : s ? critterUri(s) : null;
  return (
    <span className={"av " + className} aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: src ? "var(--panel)" : gradientFor(name) }}>
      {src ? <img src={src} alt="" draggable={false} /> : <b>{name.trim().slice(0, 1).toUpperCase()}</b>}
    </span>
  );
}
