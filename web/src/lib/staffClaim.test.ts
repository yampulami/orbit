import { describe, expect, it } from "vitest";
import { allowedHosts, decideClaim, findEvidence, problemWithClaimEmail, problemWithProofUrl } from "../../../supabase/functions/_shared/staffClaim";

const TABLE = `<table><tbody>
  <tr class="post-item"><td data-label="Name"><a class="js-open-popup">Chatman, Jasmine</a><div class="popup"><p>Jasmine leads programs for first-year students and has served as Dean of everything in her long and storied career of helping students.</p></div></td>
    <td data-label="Department">Student Engagement</td><td data-label="Title">Director of Student Engagement</td><td data-label="Email"><a href="mailto:jchatman@caldwell.edu">jchatman@caldwell.edu</a></td></tr>
  <tr class="post-item"><td data-label="Name"><a>Iudici, Savanna</a></td><td data-label="Department">Student Life</td><td data-label="Title">Administrative Assistant</td><td data-label="Email"><a href="mailto:siudici@caldwell.edu">siudici@caldwell.edu</a></td></tr>
  <tr class="post-item"><td data-label="Name"><a>Agapito, Maria</a></td><td data-label="Department">Natural Sciences</td><td data-label="Title">Dean of Sciences</td><td data-label="Email"><a href="mailto:magapito@caldwell.edu">magapito@caldwell.edu</a></td></tr>
  <tr class="post-item"><td data-label="Name"><a>Grosso, Anthony</a></td><td data-label="Department">Student Life</td><td data-label="Title">Dean of Student Life</td><td data-label="Email"><a href="mailto:agrosso@caldwell.edu">agrosso@caldwell.edu</a></td></tr>
</tbody></table>`;
const CARDS = `<div class="staff"><div class="card"><h3>Pat Rivera</h3><p class="role">Associate Director, Student Activities</p><p><a href="mailto:pat.rivera@uni.edu">pat.rivera@uni.edu</a></p></div>
  <div class="card"><h3>Lee Wong</h3><p class="role">Dean of Students</p><p><a href="mailto:lee.wong@uni.edu">lee.wong@uni.edu</a></p></div>
  <div class="card"><h3>Sam Ortiz</h3><p class="role">Student Worker</p><p><a href="mailto:sam.ortiz@uni.edu">sam.ortiz@uni.edu</a></p></div></div>`;
const GLUED = `<p>Contact the office: <a href="mailto:a@uni.edu">a@uni.edu</a> or <a href="mailto:b@uni.edu">b@uni.edu</a>. Dean of Students.</p>`;
const PERSONAL = `<html><body><h1>About me</h1><p>I am the Dean of Student Life at Uni. Reach me at <a href="mailto:me@uni.edu">me@uni.edu</a>.</p></body></html>`;

describe("finding someone on a page", () => {
  it("finds a leader in a table row and ignores the biography", () => {
    const ev = findEvidence(TABLE, "jchatman@caldwell.edu");
    expect(ev).toMatchObject({ found: true, ambiguous: false, title: "Director of Student Engagement", score: 85, officeMatched: true });
    expect(ev.others).toBe(3);
  });
  it("is not fooled by the dean of another school, or by capitals in the address", () => {
    expect(findEvidence(TABLE, "magapito@caldwell.edu")).toMatchObject({ score: 90, officeMatched: false });
    expect(findEvidence(TABLE, "AGrosso@Caldwell.edu")).toMatchObject({ found: true, title: "Dean of Student Life", score: 90 });
  });
  it("reads card layouts", () => {
    expect(findEvidence(CARDS, "lee.wong@uni.edu")).toMatchObject({ title: "Dean of Students", score: 90, officeMatched: true });
    expect(findEvidence(CARDS, "pat.rivera@uni.edu")).toMatchObject({ title: "Associate Director, Student Activities", score: 70, officeMatched: true });
    expect(findEvidence(CARDS, "sam.ortiz@uni.edu").score).toBe(0);
  });
  it("says so when two addresses share an entry", () => { expect(findEvidence(GLUED, "a@uni.edu")).toMatchObject({ found: true, ambiguous: true }); });
  it("finds nothing when the address is not there", () => { expect(findEvidence(TABLE, "nobody@caldwell.edu").found).toBe(false); });
});

describe("deciding a claim", () => {
  const d = (html: string, email: string, path = "/staff-directory/") => decideClaim(findEvidence(html, email), { path });
  it("gives a coordinator role for a leadership title in a student-life office", () => {
    expect(d(TABLE, "agrosso@caldwell.edu")).toMatchObject({ ok: true, role: "coordinator", title: "Dean of Student Life" });
    expect(d(TABLE, "jchatman@caldwell.edu")).toMatchObject({ ok: true, role: "coordinator" });
  });
  it("gives staff for a senior title below that", () => { expect(d(CARDS, "pat.rivera@uni.edu")).toMatchObject({ ok: true, role: "staff" }); });
  it("refuses assistants, other offices, strangers and glued entries", () => {
    expect(d(TABLE, "siudici@caldwell.edu")).toMatchObject({ ok: false, code: "weak_title" });
    expect(d(CARDS, "sam.ortiz@uni.edu")).toMatchObject({ ok: false, code: "weak_title" });
    expect(d(TABLE, "magapito@caldwell.edu")).toMatchObject({ ok: false, code: "wrong_office" });
    expect(d(TABLE, "nobody@caldwell.edu")).toMatchObject({ ok: false, code: "not_found" });
    expect(d(GLUED, "a@uni.edu")).toMatchObject({ ok: false, code: "ambiguous" });
  });
  it("refuses a page about one person that is not a directory", () => {
    expect(d(PERSONAL, "me@uni.edu", "/about-me/")).toMatchObject({ ok: false, code: "not_official" });
    expect(d(PERSONAL, "me@uni.edu", "/student-life/staff/me")).toMatchObject({ ok: true });
  });
});

describe("the address and the email", () => {
  it("lists the sites a school's staff pages may live on", () => {
    expect(allowedHosts("caldwell.edu")).toEqual(["caldwell.edu", "www.caldwell.edu"]);
    expect(allowedHosts("cs.uni.edu")).toEqual(["cs.uni.edu", "www.cs.uni.edu", "uni.edu", "www.uni.edu"]);
  });
  it("accepts a page on the school's own site only", () => {
    expect(problemWithProofUrl("https://www.caldwell.edu/faculty-staff-directory/", "caldwell.edu")).toBeNull();
    expect(problemWithProofUrl("https://caldwell.edu/staff/", "caldwell.edu")).toBeNull();
    expect(problemWithProofUrl("http://www.caldwell.edu/staff/", "caldwell.edu")).toMatch(/https/);
    expect(problemWithProofUrl("https://sites.google.com/caldwell.edu/x", "caldwell.edu")).toMatch(/own website/);
    expect(problemWithProofUrl("https://evil.com/caldwell.edu", "caldwell.edu")).toMatch(/own website/);
    expect(problemWithProofUrl("https://www.caldwell.edu.evil.com/staff", "caldwell.edu")).toMatch(/own website/);
    expect(problemWithProofUrl("https://www.caldwell.edu/blog/my-post", "caldwell.edu")).toMatch(/blog/);
    expect(problemWithProofUrl("https://www.caldwell.edu/~jdoe/", "caldwell.edu")).not.toBeNull();
    expect(problemWithProofUrl("https://www.caldwell.edu/student-life/staff/", "caldwell.edu")).toBeNull();
  });
  it("needs a school email, not a personal one", () => {
    expect(problemWithClaimEmail("a@caldwell.edu")).toBeNull();
    expect(problemWithClaimEmail("a@gmail.com")).toMatch(/personal/);
    expect(problemWithClaimEmail("a@Yahoo.com")).toMatch(/personal/);
  });
});
