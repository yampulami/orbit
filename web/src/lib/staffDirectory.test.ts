import { describe, expect, it } from "vitest";
import { displayName, labelFor, parseDirectoryPage, pickAccess, planRevocations, titleScore, type DirectoryPerson } from "../../../supabase/functions/_shared/staffDirectory";

// Real rows from Caldwell's public faculty and staff directory.
const P = (name: string, department: string, title: string, email: string): DirectoryPerson => ({ name, department, title, email });
const CALDWELL = [
  P("Chatman, Jasmine", "Student Engagement", "Director of Student Engagement", "jchatman@caldwell.edu"),
  P("Grosso, Anthony", "Student Life", "Dean of Student Life", "agrosso@caldwell.edu"),
  P("Striano, Cindy", "Student Life", "Associate Dean for Student Life", "Cstriano@caldwell.edu"),
  P("Francois, Danielle", "Student Life", "Education Coordinator, Student Advocacy and Prevention Awareness", "dcalligaro@caldwell.edu"),
  P("Iudici, Savanna", "Student Life", "Administrative Assistant", "siudici@caldwell.edu"),
  P("Hallaran, Alice", "Residence Life and Conduct", "Residence Life", "ahallaran@caldwell.edu"),
  P("Corino, Mark", "Athletics", "Assistant Vice President, Director of Athletics", "MCorino@caldwell.edu"),
  P("Arabitg, Heather", "Athletics", "Assistant Athletic Director for Sports Medicine, Head Athletic Trainer, & Senior Woman Administrator", "harabitg@caldwell.edu"),
  P("Arata, Michael", "Student Financial Services", "Director of Financial Aid", "marata@caldwell.edu"),
  P("Agapito, Maria", "Natural Sciences", "Associate Professor", "magapito@caldwell.edu"),
  P("Skinner, Elizabeth (Libby)", "Academic Support Services, School of Education, Student Support Services", "Accessibility Services Coordinator, Academic Success Center, Adjunct Lecturer", "eskinner@caldwell.edu"),
];
const CFG = { offices: ["student life", "student engagement", "student affairs"], domains: ["caldwell.edu"] };

describe("scoring a title", () => {
  it("puts leadership above support", () => {
    const s = titleScore;
    expect(s("Vice President for Student Affairs")).toBe(100);
    expect(s("Assistant Vice President, Director of Athletics")).toBe(95);
    expect(s("Dean of Student Life")).toBe(90);
    expect(s("Director of Student Engagement")).toBe(85);
    expect(s("Associate Dean for Student Life")).toBe(75);
    expect(s("Associate Director of Admissions")).toBe(70);
    expect(s("Assistant Director of Residence Life")).toBe(60);
    expect(s("Education Coordinator, Student Advocacy and Prevention Awareness")).toBe(45);
    expect(s("Administrative Assistant")).toBe(10);
    expect(s("Associate Professor")).toBe(0);
    expect(s("Residence Life")).toBe(0);
  });
  it("reads the words before the role, so an assistant director is not a director", () => {
    expect(titleScore("Assistant Athletic Director for Sports Medicine, Head Athletic Trainer, & Senior Woman Administrator")).toBe(60);
    expect(titleScore("Executive Director of Campus Life")).toBe(88);
    expect(titleScore("Assistant to the Dean")).toBe(10);
  });
});

describe("choosing who gets access", () => {
  const got = pickAccess(CALDWELL, CFG);
  it("makes the strongest titles in the student-life offices coordinators", () => {
    expect(got.filter((a) => a.role === "coordinator").map((a) => a.name)).toEqual(["Anthony Grosso", "Jasmine Chatman"]);
  });
  it("makes the next staff, and gives nothing to assistants, other offices, or faculty", () => {
    expect(got.filter((a) => a.role === "staff").map((a) => a.name)).toEqual(["Cindy Striano"]);
    const emails = got.map((a) => a.email);
    for (const none of ["siudici@caldwell.edu", "ahallaran@caldwell.edu", "marata@caldwell.edu", "magapito@caldwell.edu", "harabitg@caldwell.edu", "dcalligaro@caldwell.edu"]) expect(emails).not.toContain(none);
  });
  it("matches the office on the department or the title", () => {
    const g = pickAccess([P("Doe, Jo", "Administration", "Dean of Student Life", "jdoe@caldwell.edu")], CFG);
    expect(g.map((a) => a.email)).toEqual(["jdoe@caldwell.edu"]);
  });
  it("lower-cases emails and keeps one entry per address", () => {
    expect(got.find((a) => a.name === "Cindy Striano")?.email).toBe("cstriano@caldwell.edu");
    const twice = pickAccess([...CALDWELL, P("Grosso, Anthony", "Student Life", "Associate Dean", "AGROSSO@caldwell.edu")], CFG);
    expect(twice.filter((a) => a.email === "agrosso@caldwell.edu")).toHaveLength(1);
    expect(twice.find((a) => a.email === "agrosso@caldwell.edu")?.score).toBe(90);
  });
  it("ignores addresses from other domains", () => {
    expect(pickAccess([P("Roe, Al", "Student Life", "Dean of Student Life", "al@gmail.com")], CFG)).toEqual([]);
  });
  it("caps the coordinators and demotes the extras to staff", () => {
    const many = ["A", "B", "C"].map((n, i) => P(`Dean, ${n}`, "Student Life", "Dean of Student Life", `d${i}@caldwell.edu`));
    const r = pickAccess(many, { ...CFG, maxCoordinators: 2 });
    expect(r.map((a) => a.role)).toEqual(["coordinator", "coordinator", "staff"]);
  });
  it("gives a short label from the title", () => {
    expect(labelFor({ title: "Dean of Student Life", department: "Student Life" })).toBe("Dean of Student Life");
    expect(labelFor({ title: "x".repeat(120), department: "" })).toHaveLength(78);
  });
  it("turns a directory name round", () => { expect(displayName("Chatman, Jasmine")).toBe("Jasmine Chatman"); expect(displayName("Cher")).toBe("Cher"); });
});

describe("reading a directory page", () => {
  const ROW = `<table><tbody><tr class="post-item"><td data-label="Name"><a href="javascript:void(0)" class="js-open-popup">
      Chatman, Jasmine </a><div class="popup"><p>Bio &amp; more, with a mailto:other@x.edu inside.</p></div></td>
    <td data-label="Department">Student Engagement</td><td data-label="Title">Director of Student Engagement</td>
    <td data-label="Email"><a href="mailto:JChatman@caldwell.edu">
      jchatman@caldwell.edu </a></td></tr>
    <tr class="post-item"><td data-label="Name"><a class="js-open-popup">No Email</a></td><td data-label="Department">X</td><td data-label="Title">Dean</td><td data-label="Email"></td></tr></tbody></table>`;
  it("reads name, department, title and email, and skips rows without an email", () => {
    expect(parseDirectoryPage(ROW)).toEqual([{ name: "Chatman, Jasmine", department: "Student Engagement", title: "Director of Student Engagement", email: "jchatman@caldwell.edu" }]);
  });
});

describe("taking access away", () => {
  const now = pickAccess(CALDWELL, CFG);
  const hosts = [{ user_id: "u1", directory_email: "agrosso@caldwell.edu", role: "coordinator" }, { user_id: "u2", directory_email: "gone@caldwell.edu", role: "staff" }, { user_id: "u3", directory_email: null, role: "coordinator" }];
  it("removes only directory-given access for people no longer listed", () => { expect(planRevocations(hosts, now, 488, 488)).toEqual({ revoke: ["u2"] }); });
  it("never touches access you gave by hand", () => { expect(planRevocations(hosts, now, 488, 488).revoke).not.toContain("u3"); });
  it("removes nothing when the directory looks broken", () => {
    expect(planRevocations(hosts, now, 0, 488)).toEqual({ revoke: [] });
    expect(planRevocations(hosts, now, 100, 488)).toEqual({ revoke: [] });
  });
});
