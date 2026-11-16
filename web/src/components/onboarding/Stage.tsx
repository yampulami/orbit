import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Actor } from "../../lib/omega/actor";
import { useTheme } from "../../lib/theme";
import { BarWalker, type BarGeom, type Places } from "./bar";
import "./onboarding.css";

export type PageId = "campus" | "you" | "life" | "interests" | "alerts" | "look" | "account" | "done";
export type Avail = "idle" | "bad" | "checking" | "free" | "taken" | "unknown";

/** The setup page and Omega. He is made when setup opens and lives there until it closes. The form below does not know about him except that it can tell him
 *  something happened (`useOmega().emit`). Where he stands (on the progress bar, on the card of the field you are typing in, big on the last step) is
 *  worked out here from where things are on the page; what he does there is in bar.ts. */
export type OmegaEvent = "choose" | "toggle" | "device" | "theme" | "finish" | "valid" | "rejected";
type OmegaApi = { emit: (event: OmegaEvent, detail?: { dark?: boolean }) => void };
const Ctx = createContext<OmegaApi>({ emit: () => undefined });
export const useOmega = () => useContext(Ctx);

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
/** How big he is on the bar: about 46 px tall. The walker changes it for the perch and the last step. */
const SCALE = 0.3;
let measure: CanvasRenderingContext2D | null = null;

/** Where the cursor is inside a text field, on the screen (for his eyes to follow). */
function caretOf(input: HTMLInputElement): { x: number; y: number } {
  const r = input.getBoundingClientRect(), cs = getComputedStyle(input);
  measure ??= document.createElement("canvas").getContext("2d");
  let w = 0;
  if (measure) { measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; w = measure.measureText(input.value.slice(0, input.selectionStart ?? input.value.length)).width; }
  return { x: Math.min(r.right - 10, r.left + (parseFloat(cs.paddingLeft) || 0) + w), y: r.top + r.height / 2 };
}

export default function Stage({ index, count, page, children }: { index: number; count: number; page: PageId; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const theme = useTheme();
  const still = useMemo(reduced, []);
  const walker = useRef<BarWalker | null>(null);
  const actorRef = useRef<Actor | null>(null);
  const [made, setMade] = useState(false);

  const geom = useCallback((): BarGeom | null => {
    const spans = root.current?.querySelectorAll<HTMLElement>(".ob-bar span");
    if (!spans || !spans.length) return null;
    const rs = [...spans].map((s) => s.getBoundingClientRect());
    return { xs: rs.map((r) => r.left + r.width / 2), y: rs[0].top };
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const actor = new Actor({ parent: el, baseUrl: "/omega/", scale: SCALE, dark: document.documentElement.dataset.theme === "dark", still, flat: true });
    // He is drawn in a strip across the top of the window, down to just under whatever he is standing on (room for his shadow).
    const places: Places = {
      geom,
      need: (y) => { const g = geom(); if (g) actor.setBand(Math.ceil(Math.max(g.y + 24, y === null ? 0 : y + 70))); },
      perchOf: (field) => {
        const g = geom();
        const card = field.closest<HTMLElement>(".ob-card") ?? field;
        const r = card.getBoundingClientRect();
        return g ? { x: r.right - 46, y: Math.max(r.top + 1, g.y + 40) } : null;
      },
      finaleSpot: () => {
        const g = geom();
        const card = el.querySelector<HTMLElement>(".ob-main .ob-card");
        if (!g || !card) return null;
        const r = card.getBoundingClientRect();
        return { x: r.right - 74, y: Math.max(r.top + 1, g.y + 40) };
      },
    };
    const w = new BarWalker(actor, places);
    let gone = false;
    void actor.loadNow().then(() => {
      if (gone) return;
      actorRef.current = actor; walker.current = w;
      places.need(null);
      if (import.meta.env.DEV) (window as unknown as { __omega?: unknown }).__omega = { actor, walker: w };
      setMade(true);
    });
    const onResize = () => w.refit();
    // tapping him: the canvas lets clicks through, so look at where the click landed
    const onDown = (e: PointerEvent) => { if (w.hit(e.clientX, e.clientY)) void w.poke(); };
    const onMove = (e: PointerEvent) => { el.style.cursor = w.hit(e.clientX, e.clientY) ? "pointer" : ""; };
    // a text field with the cursor in it: he comes to watch, and his eyes follow what you type
    const isField = (t: EventTarget | null): t is HTMLInputElement => t instanceof HTMLInputElement && !!t.closest(".ob-main") && ["text", "search", ""].includes(t.type);
    const onIn = (e: FocusEvent) => { if (isField(e.target)) { w.watch(e.target); const c = caretOf(e.target); w.lookAt(c.x, c.y); } };
    const onOut = (e: FocusEvent) => { if (isField(e.target)) w.unwatch(); };
    const onType = (e: Event) => { if (isField(e.target)) { const c = caretOf(e.target); w.lookAt(c.x, c.y); } };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    el.addEventListener("focusin", onIn);
    el.addEventListener("focusout", onOut);
    el.addEventListener("input", onType);
    el.addEventListener("keyup", onType);
    el.addEventListener("click", onType);
    return () => {
      gone = true;
      window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize);
      window.removeEventListener("pointerdown", onDown); window.removeEventListener("pointermove", onMove);
      el.removeEventListener("focusin", onIn); el.removeEventListener("focusout", onOut);
      el.removeEventListener("input", onType); el.removeEventListener("keyup", onType); el.removeEventListener("click", onType);
      el.style.cursor = ""; w.stop(); actor.destroy(); actorRef.current = null; walker.current = null; setMade(false);
    };
  }, [geom, still]);

  useEffect(() => { actorRef.current?.setDark(theme === "dark"); }, [theme, made]);

  // A new step: he goes to its segment.
  useEffect(() => {
    const w = walker.current;
    if (!made || !w) return;
    if (still) { w.stand(index); return; }
    // the page's own field may already have the cursor (autofocus happens before we start listening): he will come to watch once he has said hello
    const ae = document.activeElement;
    if (ae instanceof HTMLInputElement && ae.closest(".ob-main") && ["text", "search", ""].includes(ae.type)) { w.watch(ae); const c = caretOf(ae); w.lookAt(c.x, c.y); }
    void w.arrive(index, { last: index === count - 1 });
  }, [made, index, count, still]);

  const api = useMemo<OmegaApi>(() => ({
    emit: (e, d) => {
      const w = walker.current;
      if (!w) return;
      if (e === "finish") { w.stop(); actorRef.current?.setOpacity(0, 220); } // the loading screen that follows has its own Omega; this one steps aside
      else if (e === "valid") w.valid();
      else if (e === "rejected") w.rejected();
      else if (e === "theme") w.theme(!!d?.dark);
      else w.react();
    },
  }), []);
  return (
    <Ctx.Provider value={api}>
      <main className="ob" ref={root} data-step={page}>{children}</main>
    </Ctx.Provider>
  );
}
