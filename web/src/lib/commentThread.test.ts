import { describe, expect, it } from "vitest";
import { buildThread, countReplies, indentOf, MAX_INDENT } from "./commentThread";

const c = (id: string, at: number, parent?: string) => ({ id, parent_id: parent ?? null, created_at: new Date(2026, 9, 22, 10, at).toISOString() });

describe("buildThread", () => {
  it("puts replies under the comment they answer, oldest first", () => {
    const t = buildThread([c("thanks", 3, "here"), c("here", 1), c("youre-welcome", 5, "thanks"), c("also", 2, "here"), c("other", 4)]);
    expect(t.map((x) => x.id)).toEqual(["here", "other"]);
    expect(t[0].replies.map((x) => x.id)).toEqual(["also", "thanks"]);
    expect(t[0].replies[1].replies.map((x) => x.id)).toEqual(["youre-welcome"]);
  });

  it("records how deep each comment is", () => {
    const t = buildThread([c("a", 1), c("b", 2, "a"), c("d", 3, "b")]);
    expect([t[0].depth, t[0].replies[0].depth, t[0].replies[0].replies[0].depth]).toEqual([0, 1, 2]);
  });

  it("does not care what order the rows arrive in", () => {
    const t = buildThread([c("d", 3, "b"), c("b", 2, "a"), c("a", 1)]);
    expect(t[0].id).toBe("a");
    expect(t[0].replies[0].replies[0].id).toBe("d");
  });

  it("lets a reply whose parent is missing stand on its own", () => {
    const t = buildThread([c("lost", 2, "gone"), c("a", 1)]);
    expect(t.map((x) => x.id)).toEqual(["a", "lost"]);
  });

  it("copes with no comments, and with a comment that points at itself", () => {
    expect(buildThread([])).toEqual([]);
    expect(buildThread([c("loop", 1, "loop")]).map((x) => x.id)).toEqual(["loop"]);
  });
});

describe("countReplies", () => {
  it("counts replies at every depth", () => {
    const [root] = buildThread([c("a", 1), c("b", 2, "a"), c("d", 3, "b"), c("e", 4, "a")]);
    expect(countReplies(root)).toBe(3);
  });
});

describe("indentOf", () => {
  it("stops indenting after a few levels", () => {
    expect(indentOf(0)).toBe(0);
    expect(indentOf(2)).toBe(2);
    expect(indentOf(9)).toBe(MAX_INDENT);
  });
});

import { ancestorsOf, directReplies, replyCount, topLevel } from "./commentThread";

describe("one level at a time", () => {
  const list = [c("answer", 1), c("question2", 2), c("thanks", 3, "answer"), c("welcome", 5, "thanks"), c("also", 4, "answer")];

  it("lists only the comments straight on the post", () => {
    expect(topLevel(list).map((x) => x.id)).toEqual(["answer", "question2"]);
  });
  it("keeps a reply whose parent is gone visible as a comment", () => {
    expect(topLevel([c("lost", 1, "gone"), c("a", 2)]).map((x) => x.id)).toEqual(["lost", "a"]);
  });
  it("lists the replies straight under a comment, oldest first", () => {
    expect(directReplies(list, "answer").map((x) => x.id)).toEqual(["thanks", "also"]);
    expect(directReplies(list, "thanks").map((x) => x.id)).toEqual(["welcome"]);
    expect(directReplies(list, "question2")).toEqual([]);
  });
  it("counts only the replies straight to a comment", () => {
    expect(replyCount(list, "answer")).toBe(2);
    expect(replyCount(list, "thanks")).toBe(1);
    expect(replyCount(list, "welcome")).toBe(0);
  });
  it("gives the comments above one, top first", () => {
    expect(ancestorsOf(list, "welcome").map((x) => x.id)).toEqual(["answer", "thanks"]);
    expect(ancestorsOf(list, "answer")).toEqual([]);
  });
  it("does not loop forever on bad data", () => {
    const loop = [c("a", 1, "b"), c("b", 2, "a")];
    expect(ancestorsOf(loop, "a").length).toBeLessThanOrEqual(1);
  });
});
