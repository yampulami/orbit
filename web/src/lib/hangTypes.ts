/** The shapes the screens use for groups, chat and hangouts. They are the same whether the data lives on this device (demo mode) or in the database. */
export const YOU = "You";

export type Rsvp = "yes" | "no";
export type Msg = { id: string; author: string; text?: string; hangoutId?: string; at: string };
/** `members` are display names, with "You" for the signed-in student. `code` is the invite code, which only members can see. */
export type Group = { id: string; name: string; members: string[]; messages: Msg[]; code?: string; /** I made this group, so I can delete it for everyone. */ mine?: boolean };
export type Hangout = {
  id: string; groupId: string; title: string; place: string; when: string; by: string; rsvps: Record<string, Rsvp>; canceled?: boolean;
  /** "group" (the default) is seen only by the group. "campus" is a public hangout anyone at the university can see and answer. */
  visibility?: "group" | "campus";
  /** Length in minutes, for the schedule board. Defaults to 90. */
  len?: number;
};
export type HangState = { groups: Group[]; hangouts: Hangout[] };
