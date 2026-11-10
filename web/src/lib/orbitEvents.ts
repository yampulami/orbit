/** What happens during first-time setup, said in plain words, so the mascot and the ring picture can each answer it without knowing about the form.
 *  The form announces real things the person did (focused a field, picked an option, a valid name, moved to another step); nothing here
 *  pretends an action happened. The pure `mascotNext` decides how the character reacts and is tested without a screen. */
export type OrbitEvent =
  | { type: "INPUT_FOCUSED"; el?: Element | null }
  | { type: "INPUT_BLURRED" }
  | { type: "TYPING_STARTED" }
  | { type: "SELECTION_MADE"; step: string; index?: number; count?: number; el?: Element | null; custom?: boolean; off?: boolean }
  | { type: "VALIDATION_SUCCESS"; what: "name" | "username" }
  | { type: "STEP_CHANGED"; from: string; to: string; dir: 1 | -1 }
  | { type: "THEME_CHANGED"; look: string }
  | { type: "THINKING" }
  | { type: "ONBOARDING_COMPLETED" };

type Listener = (e: OrbitEvent) => void;
const listeners = new Set<Listener>();

export function emitOrbit(e: OrbitEvent) {
  for (const l of [...listeners]) l(e);
}
/** Listen for events. Returns the function that stops listening. */
export function onOrbit(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export type Reaction = "selected" | "success" | "think" | "transition" | "celebrate";
/** How long each reaction plays, in milliseconds, before the character settles back to idle. */
export const REACTION_MS: Record<Reaction, number> = { selected: 400, success: 700, think: 1500, transition: 500, celebrate: 1300 };

export type MascotState = { calm: boolean; engaged: boolean; react: Reaction | null; seq: number };
export const MASCOT_REST: MascotState = { calm: false, engaged: false, react: null, seq: 0 };

const play = (s: MascotState, react: Reaction): MascotState => ({ ...s, react, seq: s.seq + 1 });

/** Pure: the character's next state for an event. Many picks in a row do not make it hop every time. */
export function mascotNext(s: MascotState, e: OrbitEvent): MascotState {
  switch (e.type) {
    case "INPUT_FOCUSED": return { ...s, engaged: true };
    case "INPUT_BLURRED": return { ...s, engaged: false, calm: false };
    case "TYPING_STARTED": return s.calm ? s : { ...s, calm: true };
    case "SELECTION_MADE":
      if (e.off) return s; // taking something away is quiet
      if (e.step === "interests" && (e.count ?? 1) > 1) return s; // react to the first pick, then let them choose in peace
      return play(s, "selected");
    case "VALIDATION_SUCCESS": return play(s, e.what === "username" ? "success" : "selected");
    case "STEP_CHANGED": return { ...play(s, "transition"), calm: false };
    case "THINKING": return play(s, "think");
    case "ONBOARDING_COMPLETED": return play(s, "celebrate");
    default: return s;
  }
}

/** Pure: how far, in degrees, a satellite hops forward for a pick. Later options in a list hop a little further, so the picture follows the choice. */
export function hopFor(index: number | undefined, count: number | undefined): number {
  if (index === undefined) return 70;
  const spread = count && count > 1 ? 140 / (count - 1) : 40;
  return 50 + index * spread * 0.6;
}
