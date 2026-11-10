import { describe, expect, it } from "vitest";
import { MASCOT_REST, emitOrbit, hopFor, mascotNext, onOrbit, type OrbitEvent } from "./orbitEvents";

describe("orbit events", () => {
  it("delivers to listeners until they stop", () => {
    const seen: string[] = [];
    const off = onOrbit((e) => seen.push(e.type));
    emitOrbit({ type: "INPUT_BLURRED" });
    off();
    emitOrbit({ type: "INPUT_BLURRED" });
    expect(seen).toEqual(["INPUT_BLURRED"]);
  });
});

describe("mascot reactions", () => {
  const run = (...es: OrbitEvent[]) => es.reduce(mascotNext, MASCOT_REST);
  it("pays attention to a focused field and relaxes when it is left", () => {
    expect(run({ type: "INPUT_FOCUSED" }).engaged).toBe(true);
    expect(run({ type: "INPUT_FOCUSED" }, { type: "INPUT_BLURRED" }).engaged).toBe(false);
  });
  it("goes calm when typing starts, and does not restart a reaction for it", () => {
    const s = run({ type: "TYPING_STARTED" });
    expect(s.calm).toBe(true);
    expect(s.seq).toBe(0);
    expect(run({ type: "TYPING_STARTED" }, { type: "TYPING_STARTED" })).toEqual(s);
  });
  it("reacts to a pick, and plays it again for the next one", () => {
    const a = run({ type: "SELECTION_MADE", step: "tenure" });
    expect(a.react).toBe("selected");
    expect(mascotNext(a, { type: "SELECTION_MADE", step: "tenure" }).seq).toBe(a.seq + 1);
  });
  it("stays quiet when something is taken away, and after the first interest", () => {
    expect(run({ type: "SELECTION_MADE", step: "interests", off: true, count: 0 }).react).toBeNull();
    expect(run({ type: "SELECTION_MADE", step: "interests", count: 1 }).react).toBe("selected");
    expect(run({ type: "SELECTION_MADE", step: "interests", count: 4 }).react).toBeNull();
  });
  it("celebrates a confirmed username more than a name, moves on calmly, and cheers at the end", () => {
    expect(run({ type: "VALIDATION_SUCCESS", what: "username" }).react).toBe("success");
    expect(run({ type: "VALIDATION_SUCCESS", what: "name" }).react).toBe("selected");
    const moved = run({ type: "TYPING_STARTED" }, { type: "STEP_CHANGED", from: "name", to: "tenure", dir: 1 });
    expect(moved.react).toBe("transition");
    expect(moved.calm).toBe(false);
    expect(run({ type: "ONBOARDING_COMPLETED" }).react).toBe("celebrate");
  });
  it("ignores events it has no reaction for", () => {
    expect(run({ type: "THEME_CHANGED", look: "dark" })).toEqual(MASCOT_REST);
  });
});

describe("satellite hops", () => {
  it("hops a fixed amount with no index, and further for later options", () => {
    expect(hopFor(undefined, undefined)).toBe(70);
    expect(hopFor(3, 4)).toBeGreaterThan(hopFor(0, 4));
    expect(hopFor(0, 4)).toBeGreaterThan(0);
  });
});
