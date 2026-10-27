import { useEffect, useRef, useState } from "react";
import Orb from "./Orb";
import { refreshEverything } from "../lib/people";
import { haptic } from "../lib/haptics";

const TRIGGER = 72;
/** On a phone, pull the page down from the top to look for anything new, like most apps. Only when the page is already at the top and the finger
 *  is not on something that scrolls by itself. */
export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (typeof matchMedia === "undefined" || !matchMedia("(pointer: coarse)").matches) return;
    const scrolledInside = (el: Element | null) => {
      for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
        const o = getComputedStyle(n).overflowY;
        if ((o === "auto" || o === "scroll") && n.scrollTop > 0) return true;
      }
      return false;
    };
    const down = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 && !scrolledInside(e.target as Element) ? e.touches[0].clientY : null;
      armed.current = false;
    };
    const move = (e: TouchEvent) => {
      if (start.current === null || busy) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0) { setPull(0); return; }
      const eased = Math.min(110, dy * 0.5);
      setPull(eased);
      if (eased >= TRIGGER && !armed.current) { armed.current = true; haptic("select"); }
    };
    const up = () => {
      if (start.current === null) return;
      start.current = null;
      if (armed.current) {
        setBusy(true); setPull(TRIGGER); haptic("success");
        refreshEverything();
        setTimeout(() => { setBusy(false); setPull(0); }, 900);
      } else setPull(0);
      armed.current = false;
    };
    document.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", up, { passive: true });
    return () => { document.removeEventListener("touchstart", down); document.removeEventListener("touchmove", move); document.removeEventListener("touchend", up); };
  }, [busy]);

  if (pull <= 0 && !busy) return null;
  return (
    <div className="ptr" style={{ transform: `translateY(${pull - 44}px)`, opacity: Math.min(1, pull / TRIGGER) }} aria-hidden="true">
      <span className="ptr-orb" style={{ transform: busy ? undefined : `scale(${1 - Math.min(0.12, pull / 900)}, ${1 + Math.min(0.28, pull / 380)})` }}><Orb size={34} variant="violet" mood={busy ? "loading" : pull >= TRIGGER ? "excited" : "idle"} poke={false} /></span>
    </div>
  );
}
