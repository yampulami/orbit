import { useEffect, useRef, useState, type ReactNode } from "react";

/** A button that asks once before doing something that cannot be undone: it turns into "Are you sure? Yes / Keep" in the same place. Pressing Escape or elsewhere backs out. */
export default function ConfirmButton({ icon, label, question, confirm, onConfirm, danger = true }: { icon?: ReactNode; label: string; question: string; confirm: string; onConfirm: () => void; danger?: boolean }) {
  const [asking, setAsking] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!asking) return;
    const out = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setAsking(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAsking(false); };
    document.addEventListener("pointerdown", out);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", out); document.removeEventListener("keydown", esc); };
  }, [asking]);
  if (!asking) return <button type="button" className="cf-act" data-danger={danger ? "" : undefined} onClick={() => setAsking(true)}>{icon}{label}</button>;
  return (
    <div className="confirm-box" ref={box} role="alertdialog" aria-label={question}>
      <p>{question}</p>
      <span><button type="button" className={"btn sm" + (danger ? " danger" : " primary")} onClick={() => { setAsking(false); onConfirm(); }}>{confirm}</button><button type="button" className="btn sm" onClick={() => setAsking(false)}>Keep</button></span>
    </div>
  );
}
