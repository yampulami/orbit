import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import Orb from "./Orb";

/** One question at a time, asked by the orb: the way Orbit collects something that would otherwise be a form. Each step has a question, one thing to answer,
 *  a gentle check, and a way back. A review step lists the answers (tap one to change it) before anything is sent. */
export type Step<S> = {
  id: string;
  ask: string;
  hint?: string;
  /** Can be skipped when nothing is filled in. */
  optional?: boolean;
  render: (s: S, set: (p: Partial<S>) => void, go: () => void) => ReactNode;
  /** A message when the answer is not good enough yet, or null. */
  check?: (s: S) => string | null;
  /** Is there anything entered? Decides whether "Skip" or "Continue" shows on an optional step. */
  empty?: (s: S) => boolean;
};

type Props<S> = {
  title: string;
  steps: Step<S>[];
  initial: S;
  /** Rows for the review step: [label, value, step id to edit]. Without it the last question sends the answers. */
  summary?: (s: S) => [string, string, string][];
  note?: ReactNode;
  submitLabel: string;
  /** Sends the answers; resolves to an error message or null. */
  onSubmit: (s: S) => Promise<string | null>;
  onCancel: () => void;
};

export default function Converse<S>({ title, steps, initial, summary, note, submitLabel, onSubmit, onCancel }: Props<S>) {
  const reduce = useReducedMotion();
  const [s, setS] = useState<S>(initial);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const total = steps.length + (summary ? 1 : 0);
  const reviewing = !!summary && i === steps.length;
  const step = steps[i];
  const lastQuestion = !summary && i === steps.length - 1;
  const stateRef = useRef(s);
  stateRef.current = s;
  const set = (p: Partial<S>) => { setS((x) => ({ ...x, ...p })); setError(""); };

  async function send(cur: S) {
    setBusy(true);
    const err = await onSubmit(cur);
    setBusy(false);
    if (err) setError(err);
  }
  function go() {
    const cur = stateRef.current;
    if (reviewing) { void send(cur); return; }
    const skipping = step.optional && step.empty?.(cur);
    const bad = skipping ? null : step.check?.(cur) ?? null;
    if (bad) { setError(bad); return; }
    setError("");
    if (lastQuestion) { void send(cur); return; }
    setDir(1); setI((n) => Math.min(n + 1, total - 1));
  }
  const back = () => { setError(""); setDir(-1); setI((n) => Math.max(0, n - 1)); };
  const jump = (id: string) => { const at = steps.findIndex((x) => x.id === id); if (at >= 0) { setError(""); setDir(-1); setI(at); } };

  const skippable = !!step && !!step.optional && !!step.empty?.(s);
  return (
    <section className="cv" aria-label={title}>
      <header className="cv-top">
        <Orb size={48} variant="violet" mood={busy ? "loading" : reviewing ? "happy" : "idle"} />
        <div className="cv-progress" role="progressbar" aria-label={`${title}, step ${i + 1} of ${total}`} aria-valuemin={1} aria-valuemax={total} aria-valuenow={i + 1}>
          {Array.from({ length: total }, (_, n) => <i key={n} className={n < i ? "done" : n === i ? "now" : ""} />)}
        </div>
        <button type="button" className="cv-x" aria-label="Cancel" onClick={onCancel}><X size={18} aria-hidden="true" /></button>
      </header>

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div key={i} className="cv-step" custom={dir}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 28 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -28 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
          {reviewing ? (
            <>
              <h2 className="cv-ask">Look good?</h2>
              <p className="cv-hint">{note ?? "Check your answers. Tap one to change it."}</p>
              <dl className="cv-review">
                {summary!(s).filter(([, v]) => v).map(([label, value, id]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd><button type="button" className="link-btn" aria-label={`Change ${label}`} onClick={() => jump(id)}>Change</button></div>
                ))}
              </dl>
            </>
          ) : (
            <>
              <h2 className="cv-ask">{step.ask}</h2>
              {step.hint && <p className="cv-hint">{step.hint}</p>}
              <div className="cv-body">{step.render(s, set, go)}</div>
            </>
          )}
          {error && <p className="error cv-error" role="alert">{error}</p>}
        </motion.div>
      </AnimatePresence>

      <footer className="cv-foot">
        {i > 0 ? <button type="button" className="link-btn" onClick={back}><ArrowLeft size={14} aria-hidden="true" /> Back</button> : <span />}
        <button type="button" className={"btn sm" + (skippable ? "" : " primary")} disabled={busy} onClick={go}>
          {busy ? "Sending…" : reviewing || lastQuestion ? <>{submitLabel} <Check size={15} aria-hidden="true" /></> : skippable ? "Skip" : <>Continue <ArrowRight size={15} aria-hidden="true" /></>}
        </button>
      </footer>
    </section>
  );
}

/* ---------- the answers: big, quiet, one at a time ---------- */
export function CvInput({ value, onChange, go, placeholder, maxLength, type = "text", inputMode, label, autoFocus = true }: { value: string; onChange: (v: string) => void; go?: () => void; placeholder?: string; maxLength?: number; type?: string; inputMode?: "numeric" | "email" | "text"; label: string; autoFocus?: boolean }) {
  return <input className="cv-input" aria-label={label} type={type} inputMode={inputMode} autoFocus={autoFocus} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && go) { e.preventDefault(); go(); } }} />;
}
export function CvText({ value, onChange, go, placeholder, maxLength, label, rows = 4 }: { value: string; onChange: (v: string) => void; go?: () => void; placeholder?: string; maxLength?: number; label: string; rows?: number }) {
  return (
    <div className="cv-textwrap">
      <textarea className="cv-input cv-text" aria-label={label} rows={rows} autoFocus value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && go) { e.preventDefault(); go(); } }} />
      {maxLength && <span className="count">{value.length}/{maxLength}</span>}
    </div>
  );
}
/** Tap to choose: one answer, or several. */
export function CvChips({ options, value, onChange, label, multi = false, max }: { options: string[]; value: string | string[]; onChange: (v: string | string[]) => void; label: string; multi?: boolean; max?: number }) {
  const sel = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div className="cv-chips" role="group" aria-label={label}>
      {options.map((o) => {
        const on = sel.includes(o);
        return <button key={o} type="button" className="chip-btn" aria-pressed={on} disabled={multi && !on && !!max && sel.length >= max} onClick={() => onChange(multi ? (on ? sel.filter((x) => x !== o) : [...sel, o]) : on ? "" : o)}>{o}</button>;
      })}
    </div>
  );
}
