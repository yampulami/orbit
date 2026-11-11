import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, NO_FILTERS, activeCount, filterListings, parsePrice, priceLabel, problemWithListing, type Listing } from "./listings";

const L = (o: Partial<Listing>): Listing => ({ id: "x", campusKey: "c", sellerId: "s", sellerName: "S", kind: "sell", title: "Thing", description: "", priceCents: 1000, category: "Other", condition: null, photos: [], status: "active", createdAt: "2026-11-01T00:00:00Z", mine: false, saved: false, ...o });

describe("prices", () => {
  it("reads what people type", () => {
    expect(parsePrice("25")).toBe(2500);
    expect(parsePrice("$12.50")).toBe(1250);
    expect(parsePrice("1,200")).toBe(120000);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("free")).toBeNull();
    expect(parsePrice("12.345")).toBeNull();
  });
  it("shows them plainly", () => {
    expect(priceLabel({ kind: "sell", priceCents: 2500 })).toBe("$25");
    expect(priceLabel({ kind: "sell", priceCents: 1250 })).toBe("$12.50");
    expect(priceLabel({ kind: "free", priceCents: null })).toBe("Free");
    expect(priceLabel({ kind: "wanted", priceCents: null })).toBe("Open to offers");
  });
});

describe("listing rules", () => {
  it("needs a title, and a price when selling", () => {
    expect(problemWithListing({ ...EMPTY_DRAFT, title: "" })).toMatch(/title/);
    expect(problemWithListing({ ...EMPTY_DRAFT, title: "Lamp", price: "" })).toMatch(/price/);
    expect(problemWithListing({ ...EMPTY_DRAFT, title: "Lamp", price: "15" })).toBeNull();
    expect(problemWithListing({ ...EMPTY_DRAFT, title: "Lamp", kind: "free" })).toBeNull();
    expect(problemWithListing({ ...EMPTY_DRAFT, title: "Lamp", price: "20000" })).toMatch(/too high/);
  });
  it("lets a wanted post leave the budget empty but not make it up", () => {
    expect(problemWithListing({ ...EMPTY_DRAFT, title: "A bike", kind: "wanted", price: "" })).toBeNull();
    expect(problemWithListing({ ...EMPTY_DRAFT, title: "A bike", kind: "wanted", price: "lots" })).toMatch(/budget/);
  });
});

describe("filtering", () => {
  const list = [
    L({ id: "a", title: "Calculus book", category: "Textbooks", createdAt: "2026-11-02T00:00:00Z" }),
    L({ id: "b", title: "Bike", kind: "free", priceCents: null, category: "Bikes and rides", createdAt: "2026-11-03T00:00:00Z", saved: true }),
    L({ id: "c", title: "Old lamp", status: "sold", mine: true, createdAt: "2026-11-04T00:00:00Z" }),
  ];
  it("hides sold listings and puts the newest first", () => {
    expect(filterListings(list, NO_FILTERS).map((l) => l.id)).toEqual(["b", "a"]);
  });
  it("narrows by kind, category, saved and words", () => {
    expect(filterListings(list, { ...NO_FILTERS, kind: "free" }).map((l) => l.id)).toEqual(["b"]);
    expect(filterListings(list, { ...NO_FILTERS, category: "Textbooks" }).map((l) => l.id)).toEqual(["a"]);
    expect(filterListings(list, { ...NO_FILTERS, savedOnly: true }).map((l) => l.id)).toEqual(["b"]);
    expect(filterListings(list, { ...NO_FILTERS, query: "CALC" }).map((l) => l.id)).toEqual(["a"]);
  });
  it("shows my own, sold ones included, under Mine", () => {
    expect(filterListings(list, { ...NO_FILTERS, mineOnly: true }).map((l) => l.id)).toEqual(["c"]);
    expect(activeCount(list)).toBe(0);
  });
});
