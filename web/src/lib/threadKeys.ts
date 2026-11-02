import type { KeyboardEvent } from "react";

/** Up and Down (or j and k) move between the conversations in a list. */
export function threadKeys(e: KeyboardEvent<HTMLDivElement>) {
  const down = e.key === "ArrowDown" || (e.key === "j" && !(e.target as HTMLElement).matches("input,textarea"));
  const up = e.key === "ArrowUp" || (e.key === "k" && !(e.target as HTMLElement).matches("input,textarea"));
  if (!down && !up) return;
  const rows = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button.thread"));
  const at = rows.indexOf(document.activeElement as HTMLButtonElement);
  const next = rows[Math.max(0, Math.min(rows.length - 1, at + (down ? 1 : -1)))];
  if (next) { e.preventDefault(); next.focus(); }
}
