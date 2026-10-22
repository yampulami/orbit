import { describe, expect, it } from "vitest";
import { checkUsername, looksLikeEmail, RESERVED } from "./username";
import { checkNewPassword, MIN_PASSWORD, validCode } from "./passwordReset";

describe("looksLikeEmail", () => {
  it("tells an email from a username", () => {
    expect(looksLikeEmail("casey@school.edu")).toBe(true);
    expect(looksLikeEmail("  casey@school.edu ")).toBe(true);
    expect(looksLikeEmail("casey_b")).toBe(false);
    expect(looksLikeEmail("@casey")).toBe(false);
    expect(looksLikeEmail("casey@")).toBe(false);
    expect(looksLikeEmail("a b@c.d")).toBe(false);
  });
});

describe("reserved usernames", () => {
  it("refuses names that could pose as the app", () => {
    for (const name of RESERVED) expect(checkUsername(name.padEnd(3, "x"))).toMatch(/reserved/);
    expect(checkUsername("@Admin")).toMatch(/reserved/);
  });
  it("still allows names that only contain one", () => {
    expect(checkUsername("orbit_fan")).toBeNull();
    expect(checkUsername("adminton")).toBeNull();
  });
});

describe("validCode", () => {
  it("accepts a number of 6 to 10 digits", () => {
    expect(validCode("123456")).toBe(true);
    expect(validCode(" 12345678 ")).toBe(true);
    expect(validCode("12345")).toBe(false);
    expect(validCode("12345678901")).toBe(false);
    expect(validCode("12a456")).toBe(false);
    expect(validCode("")).toBe(false);
  });
});

describe("checkNewPassword", () => {
  it("wants a long enough password typed the same twice", () => {
    expect(checkNewPassword("short", "short")).toMatch(String(MIN_PASSWORD));
    expect(checkNewPassword("longenough1", "longenough2")).toMatch(/not the same/);
    expect(checkNewPassword("longenough1", "longenough1")).toBeNull();
  });
});
