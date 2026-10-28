import { describe, expect, it } from "vitest";
import { applyOrder } from "./order";

const list = ["a", "b", "c", "d"].map((id) => ({ id }));

describe("applyOrder", () => {
  it("follows the saved order", () => {
    expect(applyOrder(list, ["c", "a"]).map((x) => x.id)).toEqual(["c", "a", "b", "d"]);
  });
  it("ignores ids that are gone and keeps new ones at the end in their own order", () => {
    expect(applyOrder(list, ["z", "d", "b"]).map((x) => x.id)).toEqual(["d", "b", "a", "c"]);
    expect(applyOrder(list, []).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
});

import { mergeOrder } from "./order";
describe("mergeOrder", () => {
  it("puts the rearranged ones first and keeps the rest", () => {
    expect(mergeOrder(["a", "b", "c"], ["c", "a"])).toEqual(["c", "a", "b"]);
    expect(mergeOrder([], ["x", "y"])).toEqual(["x", "y"]);
  });
});
