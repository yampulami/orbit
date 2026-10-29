/** Keyboard shortcuts, like a desktop app: "g" then a letter goes to a page, "n" starts a post, "/" searches, "?" lists them all. */
export const GO: Record<string, { to: string; label: string }> = {
  f: { to: "/app/feed", label: "Feed" },
  m: { to: "/app/chats", label: "Chats" },
  g: { to: "/app/chats?tab=groups", label: "Groups" },
  r: { to: "/app/roommates", label: "Roommates" },
  p: { to: "/app/plans", label: "Plans" },
  s: { to: "/app/sync", label: "Schedule sync" },
  c: { to: "/app/map", label: "Map" },
  u: { to: "/app/profile", label: "Profile" },
};

export type ShortcutResult = { kind: "go"; to: string } | { kind: "new" } | { kind: "search" } | { kind: "help" } | { kind: "wait" } | null;

/** Pure: what a key press means, given whether "g" was just pressed. */
export function shortcut(key: string, afterG: boolean): ShortcutResult {
  const k = key.toLowerCase();
  if (afterG) return GO[k] ? { kind: "go", to: GO[k].to } : null;
  if (k === "g") return { kind: "wait" };
  if (k === "n") return { kind: "new" };
  if (key === "/") return { kind: "search" };
  if (key === "?") return { kind: "help" };
  return null;
}

/** Keys typed into a text box are for the text box. */
export function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable === true;
}
