import type { LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

/** The colour an item turns into when you point at it: one flat tint per tone. */
export const GM = {
  purple: ["#ffd2bd", "#ff9a6b"],
  blue: ["#cfdcf3", "#9bbcf0"],
  orange: ["#f8e0b0", "#f2bd62"],
  green: ["#d3ead9", "#8fd4a8"],
  pink: ["#f4d3d7", "#eca0ac"],
} as const;

/** How wide an item's pill is once it is open. */
const pill = (label: string) => Math.round(label.length * 8.4 + 44);

export type GMItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: keyof typeof GM;
  onClick: () => void;
  /** Stays opened into its pill (a choice made, or a panel that is showing). */
  on?: boolean;
  badge?: string;
  extra?: ReactNode;
  disabled?: boolean;
};

/** A row of round icon buttons. Point at one (or tap it) and it opens into a gradient pill with its name, and the others make room. */
export default function GradientMenu({ items, label, className = "", quietOnScroll = false, captions = false, tabs = false }: { items: GMItem[]; label: string; className?: string; /** Behave as a row of tabs: one is selected, Left and Right move between them. */ tabs?: boolean; /** Write every item's name under its icon, not only the open one's. */ captions?: boolean; /** Scrolling down shrinks it to small icons (the chosen one ringed); scrolling back up, or reaching the top, opens it again. */ quietOnScroll?: boolean }) {
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    if (!quietOnScroll) return;
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      if (y < 80) setQuiet(false);
      else if (y > last + 6) setQuiet(true);
      else if (y < last - 6) setQuiet(false);
      last = y;
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [quietOnScroll]);
  return (
    <div className={"gm " + className} role={tabs ? "tablist" : "group"} aria-label={label} onKeyDown={tabs ? (e) => { if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return; const bs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")); const at = bs.indexOf(document.activeElement as HTMLButtonElement); if (at < 0) return; e.preventDefault(); const next = bs[(at + (e.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length]; next.focus(); next.click(); } : undefined} data-quiet={quiet ? "" : undefined} data-caps={captions ? "" : undefined}>
      {items.map((it) => {
        const [a, b] = GM[it.tone];
        return (
          <button
            key={it.key}
            type="button"
            className="gm-item"
            data-label={it.label}
            data-on={it.on ? "" : undefined}
            role={tabs ? "tab" : undefined}
            aria-selected={tabs ? !!it.on : undefined}
            tabIndex={tabs ? (it.on ? 0 : -1) : undefined}
            aria-pressed={tabs || it.on === undefined ? undefined : it.on}
            aria-label={it.label}
            disabled={it.disabled}
            style={{ ["--a" as string]: a, ["--b" as string]: b, ["--w" as string]: `${pill(it.label)}px` }}
            onClick={it.onClick}
          >
            <span className="gm-bg" aria-hidden="true" />
            <it.icon className="gm-ic" size={19} aria-hidden="true" />
            <span className="gm-label" aria-hidden="true">{it.label}</span>
            {captions && <span className="gm-cap" aria-hidden="true">{it.label}</span>}
            {it.badge && <span className="gm-badge">{it.badge}</span>}
            {it.extra}
          </button>
        );
      })}
    </div>
  );
}
