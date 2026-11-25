import { describe, expect, it } from "vitest";
import { introState } from "./introState";
import type { Req } from "./alumni";

const NOW = Date.parse("2026-11-25T12:00:00Z");
const req = (over: Partial<Req>): Req => ({ id: "r", otherId: "g", other: "G", note: "hi", status: "pending", at: "2026-11-20T12:00:00Z", incoming: false, ...over });

describe("introState", () => {
  it("is open when nothing was sent, and ignores requests they sent you", () => {
    expect(introState([], "g", NOW)).toBe("none");
    expect(introState([req({ incoming: true })], "g", NOW)).toBe("none");
  });
  it("shows a waiting or accepted request, accepted first", () => {
    expect(introState([req({})], "g", NOW)).toBe("pending");
    expect(introState([req({}), req({ id: "r2", status: "accepted" })], "g", NOW)).toBe("accepted");
  });
  it("waits 90 days after a no, then opens again", () => {
    expect(introState([req({ status: "declined", decidedAt: "2026-11-01T00:00:00Z" })], "g", NOW)).toBe("wait");
    expect(introState([req({ status: "declined", at: "2026-06-01T00:00:00Z", decidedAt: "2026-06-02T00:00:00Z" })], "g", NOW)).toBe("none");
  });
});
