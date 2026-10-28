import { useCallback, useEffect, useState } from "react";
import type { Pending } from "./assistantAi";

/** The assistant's chat history, kept on this device (per person). Each chat is a list of messages; the newest chat is first. */
export type Msg = { id: string; role: "user" | "assistant"; text: string; at: string; /** A page the answer can open, and what to call the button. */ go?: string; goLabel?: string; /** A change the assistant wants to make, waiting for a yes. */ pending?: Pending };
export type Chat = { id: string; title: string; updatedAt: string; messages: Msg[] };

export const MAX_CHATS = 30;
export const MAX_MSGS = 100;
export const NEW_TITLE = "New chat";

/** Pure: a chat's title from the first thing asked. */
export function titleFor(q: string): string {
  const t = q.trim().replace(/\s+/g, " ");
  if (!t) return NEW_TITLE;
  return t.length > 44 ? t.slice(0, 43).trimEnd() + "…" : t;
}

const byNewest = (a: Chat, b: Chat) => b.updatedAt.localeCompare(a.updatedAt);
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));
export const makeMsg = (role: Msg["role"], text: string, extra: Partial<Msg> = {}, now = new Date()): Msg => ({ id: uid(), role, text, at: now.toISOString(), ...extra });

/** Pure: start an empty chat at the top. */
export function startChat(chats: Chat[], now = new Date()): { chats: Chat[]; id: string } {
  const id = uid();
  return { id, chats: [{ id, title: NEW_TITLE, updatedAt: now.toISOString(), messages: [] }, ...chats].sort(byNewest).slice(0, MAX_CHATS) };
}
/** Pure: add a message to a chat. The chat is titled from its first question and moves to the top. */
export function addMessage(chats: Chat[], chatId: string, msg: Msg, now = new Date()): Chat[] {
  return chats
    .map((c) => {
      if (c.id !== chatId) return c;
      const messages = [...c.messages, msg].slice(-MAX_MSGS);
      return { ...c, messages, title: c.title === NEW_TITLE && msg.role === "user" ? titleFor(msg.text) : c.title, updatedAt: now.toISOString() };
    })
    .sort(byNewest);
}
/** Pure: change one message in place (for example, a confirm card turning from waiting to done). */
export function patchMessage(chats: Chat[], chatId: string, msgId: string, patch: Partial<Msg>): Chat[] {
  return chats.map((c) => (c.id !== chatId ? c : { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) }));
}
export const removeChat = (chats: Chat[], id: string) => chats.filter((c) => c.id !== id);

/** Pure: chats grouped for the sidebar: Today, Yesterday, then Earlier. Empty groups are left out. */
export function groupChats(chats: Chat[], now = new Date()): { label: string; chats: Chat[] }[] {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = day(now);
  const groups: { label: string; chats: Chat[] }[] = [{ label: "Today", chats: [] }, { label: "Yesterday", chats: [] }, { label: "Earlier", chats: [] }];
  for (const c of [...chats].sort(byNewest)) {
    const diff = Math.round((today - day(new Date(c.updatedAt))) / 86400000);
    groups[diff <= 0 ? 0 : diff === 1 ? 1 : 2].chats.push(c);
  }
  return groups.filter((g) => g.chats.length > 0);
}

const key = (user: string) => `orbit-assistant-chats:${user}`;
function read(user: string): Chat[] {
  try {
    const raw = localStorage.getItem(key(user));
    if (!raw) return [];
    const list = JSON.parse(raw) as Chat[];
    return Array.isArray(list) ? list.filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages)).sort(byNewest).slice(0, MAX_CHATS) : [];
  } catch { return []; }
}

/** The history for this person, with the actions to start, add to, delete and clear chats. */
export function useChatHistory(user: string) {
  const [chats, setChats] = useState<Chat[]>(() => read(user));
  useEffect(() => { setChats(read(user)); }, [user]);
  const commit = useCallback((next: Chat[]) => {
    setChats(next);
    try { localStorage.setItem(key(user), JSON.stringify(next)); } catch { /* the chat still works for now */ }
  }, [user]);

  const api = {
    /** Start an empty chat and return its id. */
    start: () => { const r = startChat(read(user)); commit(r.chats); return r.id; },
    /** Start a chat that already has its first question and answer, and return its id. */
    startWith: (q: string, a: string, extra: Partial<Msg> = {}) => {
      const r = startChat(read(user));
      const withQ = addMessage(r.chats, r.id, makeMsg("user", q));
      commit(addMessage(withQ, r.id, makeMsg("assistant", a, extra)));
      return r.id;
    },
    add: (chatId: string, msg: Msg) => commit(addMessage(read(user), chatId, msg)),
    patch: (chatId: string, msgId: string, patch: Partial<Msg>) => commit(patchMessage(read(user), chatId, msgId, patch)),
    remove: (id: string) => commit(removeChat(read(user), id)),
    clear: () => commit([]),
  };
  return { chats, ...api };
}
