import { describe, expect, it } from "vitest";
import { confirmProblem, readConfirmParams } from "./confirmEmail";

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
  it("explains a failure in plain words", () => {
    expect(confirmProblem("Email link is invalid or has expired")).toMatch(/already been used or has expired/);
    expect(confirmProblem("Too many requests, rate limit")).toMatch(/Wait a minute/);
    expect(confirmProblem("")).toMatch(/could not confirm/);
  });
});
