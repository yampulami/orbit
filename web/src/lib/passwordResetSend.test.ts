import { beforeEach, describe, expect, it, vi } from "vitest";

/** A stand-in for Supabase's reset request: the test decides what it answers. */
const reply = vi.hoisted(() => ({ error: null as null | { status?: number; code?: string; message: string } }));
vi.mock("./supabase", () => ({ supabase: { auth: { resetPasswordForEmail: async () => ({ error: reply.error }) } } }));

import { sendResetCode, timedOutButSent } from "./passwordReset";

beforeEach(() => { reply.error = null; });

describe("timedOutButSent", () => {
  it("recognises the timeout Supabase gives when the mail server is slow", () => {
    expect(timedOutButSent({ status: 504, message: "x" })).toBe(true);
    expect(timedOutButSent({ code: "request_timeout", message: "x" })).toBe(true);
    expect(timedOutButSent({ message: "context deadline exceeded" })).toBe(true);
  });
  it("does not mistake real failures for it", () => {
    expect(timedOutButSent({ status: 500, code: "unexpected_failure", message: "Error sending recovery email" })).toBe(false);
    expect(timedOutButSent({ status: 429, code: "over_email_send_rate_limit", message: "rate limit" })).toBe(false);
    expect(timedOutButSent({ status: 400, message: "Unable to validate email address" })).toBe(false);
  });
});

describe("sendResetCode", () => {
  it("succeeds when the request succeeds", async () => {
    expect(await sendResetCode("a@b.co")).toBeNull();
  });
  it("carries on when Supabase times out waiting for the mail server (the email was sent)", async () => {
    reply.error = { status: 504, code: "request_timeout", message: "context deadline exceeded" };
    expect(await sendResetCode("a@b.co")).toBeNull();
  });
  it("tells the person to wait when too many were asked for", async () => {
    reply.error = { status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" };
    expect(await sendResetCode("a@b.co")).toMatch(/wait a minute/);
  });
  it("says it could not send when sending really failed", async () => {
    reply.error = { status: 500, code: "unexpected_failure", message: "Error sending recovery email" };
    expect(await sendResetCode("a@b.co")).toMatch(/could not send/);
  });
});
