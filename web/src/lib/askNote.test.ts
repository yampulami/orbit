import { describe, expect, it } from "vitest";
import { applyStarter, problemWithNote } from "./askNote";

const shared = "We are both from Robotics Club.";
const referral = `${shared} I am applying to Acme and wondered if you could refer me. A bit about me:`;

describe("applyStarter", () => {
  it("replaces an empty box, the opening line, or an earlier starter", () => {
    expect(applyStarter("", referral, [])).toBe(referral);
    expect(applyStarter(`${shared} `, referral, [shared])).toBe(referral);
  });
  it("never wipes what the student typed", () => {
    expect(applyStarter("Hi, I am Sam.", "Would you have 20 minutes?", [shared])).toBe("Hi, I am Sam. Would you have 20 minutes?");
  });
});

describe("problemWithNote", () => {
  it("refuses a note that is only what Orbit wrote", () => {
    expect(problemWithNote(shared, [shared, referral])).toMatch(/your own/);
    expect(problemWithNote(referral, [shared, referral])).toMatch(/your own/);
    expect(problemWithNote("   ", [])).toMatch(/Write a line/);
  });
  it("accepts a note with the student's own words", () => {
    expect(problemWithNote(`${referral} I study CS and build robots.`, [shared, referral])).toBeNull();
    expect(problemWithNote("Could you tell me about your team?", [shared])).toBeNull();
  });
});
