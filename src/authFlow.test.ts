import { describe, expect, it } from "vitest";
import { credentialError, parseEmailCallback } from "./authFlow";

describe("email callback boundaries", () => {
  it("does not claim verification from a bare route", () => {
    expect(parseEmailCallback("orbit://auth/confirmed")).toEqual({
      kind: "return",
    });
    expect(parseEmailCallback("http://localhost:8084/auth/confirmed")).toEqual({
      kind: "return",
    });
  });
  it("accepts Expo callback paths but still requires server verification", () => {
    expect(
      parseEmailCallback(
        "exp://192.168.0.1:8084/--/auth/confirmed#access_token=test",
      ),
    ).toEqual({
      kind: "verify",
      accessToken: "test",
      refreshToken: null,
      recovery: false,
    });
  });
  it("rejects expired links even if a token is also present", () => {
    expect(
      parseEmailCallback(
        "orbit://auth/confirmed#error=access_denied&access_token=test",
      ).kind,
    ).toBe("invalid");
    expect(
      parseEmailCallback(
        "https://example.com/auth/confirmed?error_description=expired",
      ).kind,
    ).toBe("invalid");
  });
  it("does not treat unrelated routes containing the callback string as confirmations", () => {
    expect(
      parseEmailCallback("https://example.com/other?next=auth/confirmed").kind,
    ).toBe("unrelated");
    expect(parseEmailCallback("orbit://auth/confirmed-other").kind).toBe(
      "unrelated",
    );
    expect(parseEmailCallback("invalid").kind).toBe("unrelated");
  });
  it("distinguishes password recovery from signup", () => {
    expect(
      parseEmailCallback(
        "orbit://auth/confirmed#access_token=test&refresh_token=refresh&type=recovery",
      ),
    ).toEqual({
      kind: "verify",
      accessToken: "test",
      refreshToken: "refresh",
      recovery: true,
    });
  });
});
describe("credential validation", () => {
  it("allows existing shorter passwords at sign in", () => {
    expect(credentialError("test@example.com", "oldpass", false)).toBe("");
  });
  it("enforces new password length at signup", () => {
    expect(credentialError("test@example.com", "oldpass", true)).toContain(
      "8 characters",
    );
  });
  it("requires a valid email and a password", () => {
    expect(credentialError("bad", "password", false)).toContain("email");
    expect(credentialError("test@example.com", "", false)).toContain(
      "password",
    );
  });
});
