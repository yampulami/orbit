import { ThinkingOrb, type OrbState } from "thinking-orbs";

/** While waiting ("Loading") it is the dotted thinking orb with a word beside it. For when something is wrong it stays the quieter, red-edged glass sphere: a soft glass sphere with an edge of light that circles it and a word whose letters light up in turn. For waiting ("Loading") and, quieter and red-edged, for when something is wrong. */
export default function OrbLoader({ label = "Loading", tone = "busy", size = 168, state = "solving", look = "pill" }: { label?: string; tone?: "busy" | "error"; size?: number; /** Which of the orb's animations to show. */ state?: OrbState; /** A pill with the word beside the orb, or the orb with the word under it. */ look?: "pill" | "stack" }) {
  if (tone === "busy") {
    return (
      <div className={look === "stack" ? "wait-stack" : "wait-pill"} role="status" aria-live="polite" aria-label={label}>
        <span className="wait-orb"><ThinkingOrb state={state} size={64} /></span>
        <span className="wait-t" aria-hidden="true">{label}…</span>
      </div>
    );
  }
  return (
    <div className="ol" data-tone={tone} role={tone === "error" ? undefined : "status"} aria-live={tone === "error" ? undefined : "polite"} aria-label={tone === "error" ? undefined : label} style={{ ["--ol" as string]: `${size}px` }}>
      <div className="ol-sphere" aria-hidden="true">
        <span className="ol-ring" />
        <span className="ol-text">{label.split("").map((c, i) => <span key={i} style={{ animationDelay: `${i * 0.11}s` }}>{c}</span>)}</span>
      </div>
    </div>
  );
}
