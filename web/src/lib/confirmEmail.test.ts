import { describe, expect, it } from "vitest";
import { confirmFailure, readConfirmParams } from "./confirmEmail";
import { secondsLeft } from "./cooldown";

describe("the confirmation link", () => {
  it("reads the token and the type", () => {
    expect(readConfirmParams("?token_hash=abcDEF12_-xyz&type=email")).toEqual({ tokenHash: "abcDEF12_-xyz", type: "email" });
    expect(readConfirmParams("?token_hash=abcDEF12_-xyz&type=signup")).toEqual({ tokenHash: "abcDEF12_-xyz", type: "signup" });
  });
  it("treats an unknown type as email, and refuses a missing or odd token", () => {
    expect(readConfirmParams("?token_hash=abcDEF12_-xyz")?.type).toBe("email");
    expect(readConfirmParams("")).toBeNull();
    expect(readConfirmParams("?token_hash=short")).toBeNull();
    expect(readConfirmParams("?token_hash=bad%20token%20with%20spaces")).toBeNull();
    expect(readConfirmParams("?token_hash=" + "a".repeat(300))).toBeNull();
  });
  it("sorts a failure into used, slow or other", () => {
    expect(confirmFailure("Email link is invalid or has expired")).toBe("used");
    expect(confirmFailure("Token has already been used")).toBe("used");
    expect(confirmFailure("Too many requests, rate limit")).toBe("slow");
    expect(confirmFailure("")).toBe("other");
  });
});

describe("the wait before another email", () => {
  it("counts whole seconds down to zero and never below", () => {
    expect(secondsLeft(61_000, 1_000)).toBe(60);
    expect(secondsLeft(61_000, 60_500)).toBe(1);
    expect(secondsLeft(61_000, 61_000)).toBe(0);
    expect(secondsLeft(61_000, 99_000)).toBe(0);
    expect(secondsLeft(0, 5_000)).toBe(0);
  });
});
