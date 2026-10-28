/** A soft glass sphere with an edge of light that circles it and a word whose letters light up in turn. For waiting ("Loading") and, quieter and red-edged, for when something is wrong. */
export default function OrbLoader({ label = "Loading", tone = "busy", size = 168 }: { label?: string; tone?: "busy" | "error"; size?: number }) {
  return (
    <div className="ol" data-tone={tone} role={tone === "error" ? undefined : "status"} aria-live={tone === "error" ? undefined : "polite"} aria-label={tone === "error" ? undefined : label} style={{ ["--ol" as string]: `${size}px` }}>
      <div className="ol-sphere" aria-hidden="true">
        <span className="ol-ring" />
        <span className="ol-text">{label.split("").map((c, i) => <span key={i} style={{ animationDelay: `${i * 0.11}s` }}>{c}</span>)}</span>
      </div>
    </div>
  );
}
