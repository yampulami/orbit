import { expect, test } from "vitest";
import {
  createPost,
  filterPosts,
  likePost,
  newPostDraft,
  registerPost,
  safeWebLink,
  sampleFeed,
  validatePost,
  votePost,
} from "./feed";
import { createLocalStore } from "./localStore";
const now = Date.parse("2026-09-28T12:00:00Z");
test("post types include only their relevant payloads", () => {
  const d = {
    ...newPostDraft("Jamie"),
    body: "Hello campus",
    title: "Lamp",
    price: "0",
    location: "Quad",
    pollOptions: ["A", "B"],
  };
  const p = createPost({ ...d, kind: "marketplace" }, "Jamie", "1", now);
  expect(p.community).toBe("Marketplace");
  expect(p.listing?.cents).toBe(0);
  expect(p.poll).toBeUndefined();
  expect(p.event).toBeUndefined();
  expect(createPost(d, "Jamie", "2", now).poll?.votes).toEqual([0, 0]);
});
test("validation blocks impossible or past events and unsafe links", () => {
  const d = {
    ...newPostDraft("Jamie"),
    kind: "event" as const,
    body: "Meet up",
    title: "Meetup",
    location: "Quad",
    date: "2026-02-30",
    time: "16:00",
  };
  expect(validatePost(d, now)).toContain("real calendar");
  expect(validatePost({ ...d, date: "2026-09-01" }, now)).toContain("future");
  expect(validatePost({ ...d, date: "2027-01-01" }, now)).toBeNull();
  expect(safeWebLink("javascript:alert(1)")).toBe(false);
  expect(safeWebLink("https://example.com")).toBe(true);
});
test("marketplace validates money precision without rejecting free listings", () => {
  const d = {
    ...newPostDraft("Jamie"),
    kind: "marketplace" as const,
    body: "Good condition",
    title: "Lamp",
    location: "Quad",
  };
  for (const price of ["-1", "1e3", "1.001", "100000.01", ""])
    expect(validatePost({ ...d, price }, now)).not.toBeNull();
  expect(validatePost({ ...d, price: "0" }, now)).toBeNull();
});
test("likes, registrations, and poll changes do not inflate counts", () => {
  const p = sampleFeed()[0];
  expect(likePost(likePost(p))).toEqual(p);
  const registered = registerPost(p, now);
  expect(registered.event?.going).toBe(1);
  expect(registerPost(registered, now)).toEqual(p);
  expect(registerPost(p, Date.parse("2027-01-01"))).toEqual(p);
  const poll = sampleFeed()[1],
    first = votePost(poll, 0),
    changed = votePost(first, 1);
  expect(changed.poll?.votes).toEqual([0, 1, 0]);
  expect(votePost(changed, 1)).toEqual(poll);
  expect(votePost(poll, 99)).toEqual(poll);
});
test("community and event filters select the same canonical posts", () => {
  const posts = sampleFeed();
  expect(filterPosts(posts, "Commuters")).toHaveLength(1);
  expect(filterPosts(posts, "All", "", true)[0]).toBe(posts[0]);
  expect(filterPosts(posts, "Marketplace", "lamp")[0]).toBe(posts[2]);
  expect(filterPosts(posts, "Residents")).toEqual([]);
});
test("polls need distinct complete options", () => {
  const d = {
    ...newPostDraft("Jamie"),
    body: "Choose",
    pollOptions: ["One", "one"],
  };
  expect(validatePost(d, now)).toContain("different");
  expect(validatePost({ ...d, pollOptions: ["One", ""] }, now)).toContain(
    "every",
  );
});
test("old saves remain readable and feed interactions persist per account", async () => {
  const diskData = new Map<string, string>();
  const disk = {
    getItem: async (k: string) => diskData.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      diskData.set(k, v);
    },
  };
  const store = createLocalStore(disk, "a");
  const old = (await store.load()).state;
  expect(old.feed).toBeUndefined();
  const post = {
    ...likePost(sampleFeed()[1]),
    comments: [
      {
        id: "c",
        author: "Jamie",
        body: "Hi",
        createdAt: new Date(now).toISOString(),
      },
    ],
  };
  await store.save({ ...old, feed: [post] });
  expect((await createLocalStore(disk, "a").load()).state.feed).toEqual([post]);
  expect((await createLocalStore(disk, "b").load()).state.feed).toBeUndefined();
  expect((await createLocalStore(disk).load()).state.feed).toBeUndefined();
});
