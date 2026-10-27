import { describe, expect, it } from "vitest";
import { countdown, dayLabel, eventFlavor, hueFor } from "./look";

describe("hueFor", () => {
  it("is stable for a name and stays between violet and pink", () => {
    expect(hueFor("Chess Club")).toBe(hueFor("  chess club "));
    for (const n of ["Robotics", "Film Society", "Student Life", "A"]) { const h = hueFor(n); expect(h).toBeGreaterThanOrEqual(240); expect(h).toBeLessThan(350); }
  });
});

describe("eventFlavor", () => {
  it("reads the kind of event from the words", () => {
    expect(eventFlavor("Soldering workshop")?.label).toBe("Workshop");
    expect(eventFlavor("Open build night")?.label).toBe("Workshop");
    expect(eventFlavor("Guest speaker: careers in tech")?.label).toBe("Talk");
    expect(eventFlavor("Spring tournament")?.label).toBe("Game night");
    expect(eventFlavor("Outdoor movie screening")?.label).toBe("Social");
    expect(eventFlavor("Quarterly update")).toBeNull();
  });
  it("falls back to the description", () => {
    expect(eventFlavor("Thursday", "Bring snacks for the potluck")?.label).toBe("Food");
  });
});

describe("countdown", () => {
  const now = new Date(2026, 9, 27, 12, 0);
  const at = (d: number, h: number, m = 0) => new Date(2026, 9, 27 + d, h, m).toISOString();
  it("says how close it is", () => {
    expect(countdown(at(0, 11), at(0, 13), now)).toEqual({ text: "Happening now", tone: "live" });
    expect(countdown(at(0, 12, 25), undefined, now)).toEqual({ text: "Starts in 25 min", tone: "soon" });
    expect(countdown(at(0, 15), undefined, now).text).toBe("In 3 h");
    expect(countdown(at(1, 9), undefined, now).text).toBe("Tomorrow");
    expect(countdown(at(3, 9), undefined, now).text).toBe("In 3 days");
    expect(countdown(at(-1, 9), at(-1, 10), now).tone).toBe("past");
  });
});

describe("dayLabel", () => {
  const now = new Date(2026, 9, 27, 12, 0);
  it("names today and tomorrow", () => {
    expect(dayLabel(new Date(2026, 9, 27, 18).toISOString(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 28, 8).toISOString(), now)).toBe("Tomorrow");
  });
});
