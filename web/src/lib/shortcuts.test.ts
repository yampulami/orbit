import { describe, expect, it } from "vitest";
import { isTyping, shortcut } from "./shortcuts";

describe("keyboard shortcuts", () => {
  it("g then a letter goes to a page", () => {
    expect(shortcut("g", false)).toEqual({ kind: "wait" });
    expect(shortcut("m", true)).toEqual({ kind: "go", to: "/app/chats" });
    expect(shortcut("s", true)).toEqual({ kind: "go", to: "/app/sync" });
    expect(shortcut("P", true)).toEqual({ kind: "go", to: "/app/plans" });
    expect(shortcut("z", true)).toBeNull();
  });
  it("single keys do their one thing", () => {
    expect(shortcut("n", false)).toEqual({ kind: "new" });
    expect(shortcut("/", false)).toEqual({ kind: "search" });
    expect(shortcut("?", false)).toEqual({ kind: "help" });
    expect(shortcut("x", false)).toBeNull();
  });
  it("a letter alone does not go anywhere", () => { expect(shortcut("m", false)).toBeNull(); });
  it("leaves keys typed in a text box alone", () => {
    expect(isTyping({ tagName: "INPUT" } as Element)).toBe(true);
    expect(isTyping({ tagName: "DIV", isContentEditable: true } as unknown as Element)).toBe(true);
    expect(isTyping({ tagName: "BUTTON" } as Element)).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
