import { expect, test } from "vitest";
import { createLocalStore, draftKey, type Draft } from "./localStore";
import { seed } from "./model";
import { emptyProfile, validProfile, toggleInterest, profileSuggestions } from "./studentProfile";

test("accounts cannot load another account's or the preview's local records", async () => {
  const disk = memory();
  const preview = createLocalStore(disk);
  const base = (await preview.load()).state;
  await preview.save({...base,name:"Preview"});
  const first = createLocalStore(disk,"user-a");
  expect((await first.load()).state.name).toBe(base.name);
  await first.save({...base,name:"Account A"});
  await first.saveDrafts({pending:draft});
  expect((await createLocalStore(disk,"user-b").load()).drafts).toEqual({});
  expect((await createLocalStore(disk,"user-b").load()).state.name).toBe(base.name);
  expect((await createLocalStore(disk,"user-a").load()).state.name).toBe("Account A");
  expect((await createLocalStore(disk).load()).state.name).toBe("Preview");
});

test("onboarding supports multiple interests and useful commuter personalization",()=>{
  const p={...emptyProfile(),lifestyle:"Commuter",major:"Biology",hobbies:["Coding"],clubs:[]};
  expect(validProfile(p)).toBe(true);
  expect(validProfile({...p,hobbies:"Coding"})).toBe(false);
  expect(toggleInterest(["Music"],"Coding")).toEqual(["Music","Coding"]);
  expect(toggleInterest(["Music","Coding"],"Music")).toEqual(["Coding"]);
  expect(profileSuggestions(p)[0].title).toContain("between classes");
  expect(profileSuggestions(p)[0].detail).toContain("Biology");
  expect(profileSuggestions(p)[1].title).toBe("Explore tech clubs");
});
const draft: Draft = {
  title: "Unfinished groceries",
  amount: "10.01",
  owner: "You",
  points: "2",
  category: "Produce",
  date: "",
  time: "",
  email: "",
};
function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

test("Orbit recovers old state and drafts, then prefers its new record", async () => {
  const disk = memory();
  const original = { version: 2, state: seed(), drafts: { pending: draft } };
  disk.data.set("campo-native-v2", JSON.stringify(original));
  const store = createLocalStore(disk);
  expect(await store.load()).toEqual({ state: original.state, drafts: original.drafts });
  await store.save({ ...original.state, name: "Orbit user" });
  expect(disk.data.has("orbit-native-v2")).toBe(true);
  expect(disk.data.get("campo-native-v2")).toBe(JSON.stringify(original));
  const recovered = await createLocalStore(disk).load();
  expect(recovered.state.name).toBe("Orbit user");
  expect(recovered.drafts.pending).toEqual(draft);
  disk.data.set("orbit-native-v2", "corrupt");
  await expect(createLocalStore(disk).load()).rejects.toThrow();
});
test("legacy state migrates without deleting the original; drafts recover by space and form", async () => {
  const disk = memory();
  const original = seed();
  disk.data.set("campo-native-v1", JSON.stringify(original));
  const store = createLocalStore(disk);
  expect((await store.load()).state).toEqual(original);
  const key = draftKey(original.active, "expense");
  await store.saveDrafts({
    [key]: draft,
    [draftKey("other", "expense")]: { ...draft, title: "Other room" },
  });
  const recovered = await createLocalStore(disk).load();
  expect(recovered.drafts[key]).toEqual(draft);
  expect(recovered.drafts[draftKey(original.active, "task")]).toBeUndefined();
  expect(recovered.drafts[draftKey("other", "expense")].title).toBe(
    "Other room",
  );
  expect(disk.data.has("campo-native-v1")).toBe(true);
});
test("submission saves data and removes its draft in the same write", async () => {
  const disk = memory();
  const store = createLocalStore(disk);
  const { state } = await store.load();
  const key = draftKey(state.active, "task");
  await store.saveDrafts({ [key]: draft });
  await store.save({ ...state, name: "Saved change" }, key);
  const loaded = await createLocalStore(disk).load();
  expect(loaded.state.name).toBe("Saved change");
  expect(loaded.drafts[key]).toBeUndefined();
});
test("failed writes reject; retry saves latest state and retains other drafts", async () => {
  const disk = memory();
  let fail = true;
  const store = createLocalStore({
    ...disk,
    setItem: async (key, value) => {
      if (fail) throw Error("Disk full");
      await disk.setItem(key, value);
    },
  });
  const { state } = await store.load();
  await expect(store.saveDrafts({ pending: draft })).rejects.toThrow(
    "Disk full",
  );
  fail = false;
  await store.save({ ...state, name: "Latest" });
  const loaded = await createLocalStore(disk).load();
  expect(loaded.state.name).toBe("Latest");
  expect(loaded.drafts.pending).toEqual(draft);
});
test("an older delayed draft write cannot overwrite a newer submission", async () => {
  const disk = memory();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const store = createLocalStore({
    ...disk,
    setItem: async (key, value) => {
      if (++calls === 1) await gate;
      await disk.setItem(key, value);
    },
  });
  const { state } = await store.load();
  const first = store.saveDrafts({ pending: draft });
  const second = store.save({ ...state, name: "Newest" }, "pending");
  release();
  await Promise.all([first, second]);
  const loaded = await createLocalStore(disk).load();
  expect(loaded.state.name).toBe("Newest");
  expect(loaded.drafts).toEqual({});
});
test("discard is durable and does not erase saved app data", async () => {
  const disk = memory();
  const store = createLocalStore(disk);
  const { state } = await store.load();
  await store.saveDrafts({ pending: draft });
  await store.saveDrafts({});
  expect(await createLocalStore(disk).load()).toEqual({ state, drafts: {} });
});
test("malformed drafts and failed reads do not overwrite stored records", async () => {
  const disk = memory();
  const raw = JSON.stringify({
    version: 2,
    state: seed(),
    drafts: { pending: { title: 5 } },
  });
  disk.data.set("campo-native-v2", raw);
  await expect(createLocalStore(disk).load()).rejects.toThrow();
  expect(disk.data.get("campo-native-v2")).toBe(raw);
  await expect(
    createLocalStore({
      ...disk,
      getItem: async () => {
        throw Error("Read failed");
      },
    }).load(),
  ).rejects.toThrow("Read failed");
});
