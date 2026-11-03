import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

/** The live directory of people: what each person is called, their @username, avatar, bio and free-time tags, kept up to date.
 *  Posts and comments store the author's name from when they wrote them; anywhere that shows a person asks the directory first,
 *  so a change (a new picture, name, username or bio) shows on everyone's screen as soon as it is saved, without reloading. */
export type Entry = { name?: string; username?: string; avatar?: string; bio?: string; hobbies?: string[] };

const store = new Map<string, Entry>();
const asked = new Set<string>();
const subs = new Set<() => void>();
let version = 0;
const bump = () => { version++; subs.forEach((f) => f()); };

type Row = { user_id?: string; display_name?: string | null; username?: string | null; avatar?: string | null; bio?: string | null; hobbies?: string[] | null };
const COLUMNS = "user_id,display_name,username,avatar,bio,hobbies";
const BASIC = "user_id,display_name,username,bio,hobbies";

const fromRow = (r: Row): Entry => ({
  name: r.display_name?.trim() || undefined,
  username: r.username || undefined,
  avatar: r.avatar ?? "",
  bio: r.bio ?? undefined,
  hobbies: r.hobbies ?? undefined,
});
function merge(id: string, patch: Entry) {
  store.set(id, { ...store.get(id), ...patch });
}

/** One change from the database: a profile was made or edited. */
export function applyProfileRow(row: Row | null | undefined) {
  if (!row?.user_id) return;
  const incoming = fromRow(row);
  // A change event may carry only some columns (the ones the database sends); keep what we already know for the rest.
  const clean = Object.fromEntries(Object.entries(incoming).filter(([k, v]) => v !== undefined || k === "avatar")) as Entry;
  if (!("avatar" in row)) delete clean.avatar;
  merge(row.user_id, clean);
  asked.add(row.user_id);
  bump();
  announce();
}

/** Lists that were built from names (group chats, conversations, club members) look themselves up again shortly after someone changes their profile. */
let announced: number | undefined;
function announce() {
  if (typeof window === "undefined") return;
  if (announced !== undefined) window.clearTimeout(announced);
  announced = window.setTimeout(() => { announced = undefined; window.dispatchEvent(new Event("orbit-people-changed")); }, 600);
}

let channelOn = false;
function listen() {
  if (channelOn || !supabase) return;
  channelOn = true;
  supabase.channel("directory")
    .on("postgres_changes", { event: "*", schema: "public", table: "student_profiles" }, (p) => applyProfileRow(p.new as Row))
    .subscribe();
}

let timer: number | undefined;
const queue = new Set<string>();
async function flush() {
  timer = undefined;
  const ids = [...queue];
  queue.clear();
  if (!supabase || ids.length === 0) return;
  let rows: Row[] = [];
  const full = await supabase.from("student_profiles").select(COLUMNS).in("user_id", ids);
  if (!full.error) rows = (full.data ?? []) as Row[];
  else rows = ((await supabase.from("student_profiles").select(BASIC).in("user_id", ids)).data ?? []) as Row[]; // before the avatar update reaches the database
  for (const r of rows) merge(r.user_id as string, fromRow(r));
  bump();
}

/** Ask for these people. They fill in when loaded, and stay current afterwards. Cheap to call again. */
export function ensurePeople(ids: (string | undefined)[]) {
  if (supabase) listen();
  for (const id of ids) {
    if (!id || asked.has(id)) continue;
    asked.add(id);
    if (!supabase) continue;
    queue.add(id);
    if (timer === undefined) timer = setTimeout(() => void flush(), 40) as unknown as number;
  }
}

/** Something about yourself changed here: show it now (the database change follows and says the same). */
export function patchPerson(id: string, patch: Entry) {
  merge(id, patch);
  asked.add(id);
  bump();
}

/** Seed from something already known without a request (a profile loaded elsewhere). Does not overwrite what is known. */
export function seedPerson(id: string, e: Entry) {
  const have = store.get(id) ?? {};
  const fill = Object.fromEntries(Object.entries(e).filter(([k, v]) => v !== undefined && (have as Record<string, unknown>)[k] === undefined));
  if (Object.keys(fill).length) merge(id, fill as Entry);
}

export function personNow(id: string | undefined): Entry | undefined { return id ? store.get(id) : undefined; }

const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
/** What the directory knows about this person, kept current. */
export function usePerson(id: string | undefined): Entry | undefined {
  useSyncExternalStore(subscribe, () => version);
  if (id) ensurePeople([id]);
  return id ? store.get(id) : undefined;
}
/** The name to show: the live one, or the one saved with the post or comment. */
export function useLiveName(id: string | undefined, fallback: string): string {
  return usePerson(id)?.name || fallback;
}

/** For tests. */
export function resetDirectory() { store.clear(); asked.clear(); version = 0; }
