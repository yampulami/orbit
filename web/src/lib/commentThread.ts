/** Comments arrive as a flat list where a reply points at the comment it answers (`parent_id`). This arranges them into threads:
 *  top-level comments oldest first, and under each one its replies oldest first, and replies to those, as deep as people go. */
export type ThreadItem = { id: string; parent_id?: string | null; created_at: string };
export type Threaded<T extends ThreadItem> = T & { replies: Threaded<T>[]; depth: number };

export function buildThread<T extends ThreadItem>(comments: T[]): Threaded<T>[] {
  const byId = new Map<string, Threaded<T>>();
  for (const c of comments) byId.set(c.id, { ...c, replies: [], depth: 0 });
  const roots: Threaded<T>[] = [];
  const oldestFirst = (a: ThreadItem, b: ThreadItem) => a.created_at.localeCompare(b.created_at);
  for (const c of [...byId.values()].sort(oldestFirst)) {
    const parent = c.parent_id ? byId.get(c.parent_id) : undefined;
    if (parent && parent !== c) parent.replies.push(c); else roots.push(c); // a reply whose parent is gone stands on its own
  }
  const setDepth = (list: Threaded<T>[], depth: number) => list.forEach((c) => { c.depth = depth; setDepth(c.replies, depth + 1); });
  setDepth(roots, 0);
  return roots;
}

/** How many replies sit under this comment, at any depth. */
export const countReplies = <T extends ThreadItem>(c: Threaded<T>): number => c.replies.reduce((n, r) => n + 1 + countReplies(r), 0);

/** Indentation stops growing after a few levels so a long back and forth stays readable; the reply still belongs to the comment it answers. */
export const MAX_INDENT = 3;
export const indentOf = (depth: number) => Math.min(depth, MAX_INDENT);

/* ---------- one level at a time, like Twitter and Instagram ---------- */

const oldestFirst = (a: ThreadItem, b: ThreadItem) => a.created_at.localeCompare(b.created_at);

/** The comments straight on the post, oldest first. A reply whose parent is missing counts as one, so nothing is ever hidden. */
export function topLevel<T extends ThreadItem>(comments: T[]): T[] {
  const ids = new Set(comments.map((c) => c.id));
  return comments.filter((c) => !c.parent_id || c.parent_id === c.id || !ids.has(c.parent_id)).sort(oldestFirst);
}

/** The replies straight under one comment, oldest first. */
export const directReplies = <T extends ThreadItem>(comments: T[], parentId: string): T[] =>
  comments.filter((c) => c.parent_id === parentId && c.id !== parentId).sort(oldestFirst);

/** The number shown beside a comment's reply icon: replies straight to it (replies to those are counted on those replies). */
export const replyCount = <T extends ThreadItem>(comments: T[], id: string): number => directReplies(comments, id).length;

/** The comments above this one, from the top-level comment down to its parent: the context shown over an opened thread. */
export function ancestorsOf<T extends ThreadItem>(comments: T[], id: string): T[] {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const chain: T[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id);
  while (cur?.parent_id && byId.has(cur.parent_id) && !seen.has(cur.parent_id)) {
    cur = byId.get(cur.parent_id)!;
    seen.add(cur.id);
    chain.unshift(cur);
  }
  return chain;
}
