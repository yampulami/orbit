import { describe, expect, it } from "vitest";
import { addMessage, groupChats, makeMsg, MAX_MSGS, NEW_TITLE, removeChat, startChat, titleFor, type Chat } from "./assistantChats";

const day = (n: number, h = 12) => new Date(2026, 9, 27 + n, h, 0);

describe("titles", () => {
  it("come from the first question, shortened", () => {
    expect(titleFor("  what's   on tonight? ")).toBe("what's on tonight?");
    expect(titleFor("x".repeat(80)).length).toBe(44);
    expect(titleFor("x".repeat(80)).endsWith("…")).toBe(true);
    expect(titleFor("   ")).toBe(NEW_TITLE);
  });
});

describe("chats", () => {
  it("starts empty, is titled by its first question, and moves to the top", () => {
    const a = startChat([], day(0, 9));
    const b = startChat(a.chats, day(0, 10));
    expect(b.chats[0].id).toBe(b.id);
    const next = addMessage(b.chats, a.id, makeMsg("user", "when is my next class"), day(0, 11));
    expect(next[0].id).toBe(a.id);
    expect(next[0].title).toBe("when is my next class");
    // a later question does not retitle it
    const again = addMessage(next, a.id, makeMsg("user", "and tomorrow?"), day(0, 12));
    expect(again[0].title).toBe("when is my next class");
    expect(again[0].messages).toHaveLength(2);
  });
  it("keeps only the latest messages and can delete a chat", () => {
    let chats: Chat[] = startChat([], day(0)).chats;
    const id = chats[0].id;
    for (let i = 0; i < MAX_MSGS + 5; i++) chats = addMessage(chats, id, makeMsg("user", "q" + i), day(0, 13));
    expect(chats[0].messages).toHaveLength(MAX_MSGS);
    expect(chats[0].messages[MAX_MSGS - 1].text).toBe("q" + (MAX_MSGS + 4));
    expect(removeChat(chats, id)).toHaveLength(0);
  });
  it("groups the sidebar into today, yesterday and earlier", () => {
    const mk = (id: string, d: Date): Chat => ({ id, title: id, updatedAt: d.toISOString(), messages: [] });
    const groups = groupChats([mk("old", day(-5)), mk("y", day(-1)), mk("t", day(0, 8)), mk("t2", day(0, 9))], day(0, 18));
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Earlier"]);
    expect(groups[0].chats.map((c) => c.id)).toEqual(["t2", "t"]);
    expect(groupChats([mk("t", day(0))], day(0)).map((g) => g.label)).toEqual(["Today"]);
  });
});
