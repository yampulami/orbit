import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";

export type SegOption<T extends string | number> = { value: T; label: string; icon?: ReactNode };

/** A row of choices where the highlight slides to the one you pick. One choice is always on. */
export default function Segmented<T extends string | number>({ options, value, onChange, label, className = "" }: { options: SegOption<T>[]; value: T; onChange: (v: T) => void; label: string; className?: string }) {
  const id = useId();
  const move = (dir: number) => {
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + dir + options.length) % options.length];
    if (next) onChange(next.value);
  };
  return (
    <div className={"seg " + className} role="radiogroup" aria-label={label} style={{ ["--n" as string]: options.length }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className="seg-opt"
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
            }}
          >
            {on && <motion.span layoutId={"seg-" + id} className="seg-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="seg-lbl">{o.icon}{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
