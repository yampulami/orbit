import type { LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

/** The colours an item can melt into when you point at it: soft gradients, each with a glow. */
export const GM = {
  purple: ["#e3c4ff", "#a96bff"],
  blue: ["#c6dcff", "#6f9cff"],
  orange: ["#ffd0b0", "#ff8a5c"],
  green: ["#d2fcbd", "#6fe0a0"],
  pink: ["#ffc2e8", "#ef5fcf"],
} as const;

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
export default function GradientMenu({ items, label, className = "", quietOnScroll = false }: { items: GMItem[]; label: string; className?: string; /** Scrolling down shrinks it to small icons (the chosen one ringed); scrolling back up, or reaching the top, opens it again. */ quietOnScroll?: boolean }) {
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
    <div className={"gm " + className} role="group" aria-label={label} data-quiet={quiet ? "" : undefined}>
      {items.map((it) => {
        const [a, b] = GM[it.tone];
        return (
          <button
            key={it.key}
            type="button"
            className="gm-item"
            data-on={it.on ? "" : undefined}
            aria-pressed={it.on === undefined ? undefined : it.on}
            aria-label={it.label}
            disabled={it.disabled}
            style={{ ["--a" as string]: a, ["--b" as string]: b, ["--w" as string]: `${Math.round(it.label.length * 8.4 + 44)}px` }}
            onClick={it.onClick}
          >
            <it.icon className="gm-ic" size={19} aria-hidden="true" />
            <span className="gm-label" aria-hidden="true">{it.label}</span>
            {it.badge && <span className="gm-badge">{it.badge}</span>}
            {it.extra}
          </button>
        );
      })}
    </div>
  );
}
