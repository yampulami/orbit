/** Showing the same Apple-style emoji on every device (an Android phone or a Windows laptop would otherwise draw its own).
 *
 *  Emoji in text are swapped for small pictures when they are shown. The pictures come from the open "emoji-datasource-apple" package through a
 *  public CDN, loaded only when an emoji appears. They are Apple's artwork, so using them is a licensing choice for whoever runs Orbit: to use a
 *  different look, change EMOJI_SET and EMOJI_BASE below (for example to "twitter" or "google"). If a picture cannot be loaded, the device's own
 *  emoji is shown instead, so nothing is ever blank. */
export const EMOJI_SET = "apple";
export const EMOJI_BASE = `https://cdn.jsdelivr.net/npm/emoji-datasource-${EMOJI_SET}@15.1.2/img/${EMOJI_SET}/64/`;

const MOD = "[\\u{1F3FB}-\\u{1F3FF}]";
const PIC = "(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F)";
/** One emoji, including skin tones, joined families and professions, flags and keycaps. Plain text symbols (like the trademark sign) are left alone. */
const EMOJI = new RegExp(
  `(\\p{RI}\\p{RI}|[0-9#*]\\uFE0F?\\u20E3|${PIC}${MOD}?(?:\\u200D(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic})\\uFE0F?${MOD}?)*)`,
  "gu",
);

export type Piece = { text: string } | { emoji: string };

/** Splits text into plain runs and emoji. Joining the pieces gives back exactly the original text. */
export function splitEmoji(text: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    out.push({ emoji: m[0] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Whether the text has any emoji. (A separate pattern: a "global" one remembers where it stopped, which would make the next search skip the start.) */
const ANY = new RegExp(EMOJI.source, "u");
export const hasEmoji = (text: string) => ANY.test(text);

const hex = (s: string) => Array.from(s).map((c) => (c.codePointAt(0) as number).toString(16).padStart(4, "0")).join("-");

/** Picture addresses to try for an emoji, best first: the picture files are named with or without the invisible "emoji style" mark. */
export function emojiUrls(e: string): string[] {
  const full = hex(e);
  const bare = hex(e.replace(/\uFE0F/g, ""));
  const withMark = hex(e.replace(/️/g, "") + "️");
  return [...new Set([full, bare, withMark])].map((n) => `${EMOJI_BASE}${n}.png`);
}
