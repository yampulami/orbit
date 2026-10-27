import { beforeEach, describe, expect, it, vi } from "vitest";

const vibrate = vi.fn();

function setup(o: { reduced?: boolean; coarse?: boolean; canVibrate?: boolean; saved?: string | null } = {}) {
  vi.resetModules();
  vibrate.mockReset();
  vi.useFakeTimers();
  vi.stubGlobal("document", { createElement: () => ({ setAttribute() {}, style: {}, appendChild() {}, click() {} }), body: { appendChild() {} }, addEventListener() {} });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") ? !!o.reduced : q.includes("coarse") ? !!o.coarse : false }));
  vi.stubGlobal("navigator", o.canVibrate === false ? {} : { vibrate });
  vi.stubGlobal("localStorage", { getItem: () => o.saved ?? null, setItem: vi.fn(), removeItem: vi.fn() });
}

beforeEach(() => { vi.useRealTimers(); });

describe("haptics", () => {
  it("buzzes the pattern for the feel", async () => {
    setup(); const { haptic } = await import("./haptics");
    haptic("success");
    expect(vibrate).toHaveBeenCalledWith([10, 45, 18]);
  });

  it("treats a pile of calls in one moment as one tap", async () => {
    setup(); const { haptic } = await import("./haptics");
    haptic("tap"); haptic("tap"); haptic("select");
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("does nothing when switched off, or when the device asked for less motion", async () => {
    setup({ saved: "0" }); let m = await import("./haptics");
    m.haptic("tap");
    expect(vibrate).not.toHaveBeenCalled();
    setup({ reduced: true }); m = await import("./haptics");
    m.haptic("tap");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("is quiet where there is nothing to vibrate with", async () => {
    setup({ canVibrate: false, coarse: false }); const { haptic } = await import("./haptics");
    expect(() => haptic("tap")).not.toThrow();
  });

  it("remembers the setting and gives a tap when turned on", async () => {
    setup({ saved: "0" }); const m = await import("./haptics");
    expect(m.hapticsOn()).toBe(false);
    m.setHaptics(true);
    expect(m.hapticsOn()).toBe(true);
    expect(vibrate).toHaveBeenCalled();
  });
});
