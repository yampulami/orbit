import { seed, type State } from "./model";
export type Draft = {
  title: string;
  amount: string;
  owner: string;
  points: string;
  category: string;
  date: string;
  time: string;
  email: string;
};
export type Drafts = Record<string, Draft>;
type Disk = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
const KEY = "orbit-native-v2";
export const draftKey = (space: string, form: string) =>
  JSON.stringify([space, form]);
const fields = [
  "title",
  "amount",
  "owner",
  "points",
  "category",
  "date",
  "time",
  "email",
] as const;
function validState(data: State) {
  return (
    data?.version === 1 &&
    Array.isArray(data.spaces) &&
    data.spaces.length > 0 &&
    data.spaces.some((s) => s.id === data.active) &&
    Array.isArray(data.hangouts)
  );
}
export function createLocalStore(disk: Disk, accountId?: string) {
  const key = accountId ? `orbit-account-${accountId}-v2` : KEY;
  let current: { version: 2; state: State; drafts: Drafts } | undefined;
  let writes: Promise<void> = Promise.resolve();
  function write() {
    if (!current) throw new Error("Load storage before writing.");
    const snapshot = JSON.stringify(current);
    const result = writes
      .catch(() => {})
      .then(() => disk.setItem(key, snapshot));
    writes = result;
    return result;
  }
  return {
    async load() {
      // Keep previous branding keys readable; never delete the original records.
      const raw = (await disk.getItem(key)) ?? (accountId ? null : await disk.getItem("campo-native-v2"));
      if (raw) {
        const data = JSON.parse(raw);
        if (
          data?.version !== 2 ||
          !validState(data.state) ||
          !data.drafts ||
          typeof data.drafts !== "object" ||
          Array.isArray(data.drafts) ||
          !Object.values(data.drafts).every(
            (d) =>
              d && fields.every((f) => typeof (d as Draft)[f] === "string"),
          )
        )
          throw new Error("Saved data cannot be read.");
        current = data;
      } else {
        const legacy = accountId ? null : await disk.getItem("campo-native-v1");
        const state = legacy ? JSON.parse(legacy) : seed();
        if (!validState(state)) throw new Error("Saved data cannot be read.");
        current = { version: 2, state, drafts: {} };
      }
      return { state: current!.state, drafts: { ...current!.drafts } };
    },
    save(state: State, clearDraft?: string) {
      if (!current) throw new Error("Load storage before writing.");
      const drafts = { ...current.drafts };
      if (clearDraft) delete drafts[clearDraft];
      current = { version: 2, state, drafts };
      return write();
    },
    saveDrafts(drafts: Drafts) {
      if (!current) throw new Error("Load storage before writing.");
      current = { ...current, drafts: { ...drafts } };
      return write();
    },
  };
}
