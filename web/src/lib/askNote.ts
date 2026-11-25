/** Rules for the note a student sends a graduate. A starter is a beginning, never the whole message, and it never wipes what was typed. */
export const NOTE_MAX = 300;
const MIN_OWN = 8; // characters the student has to add themselves

/** What a starter does to the box: it replaces an untouched opening (or an earlier starter), and otherwise is added after the student's own words. */
export function applyStarter(note: string, line: string, untouched: string[]): string {
  const now = note.trim();
  if (!now || untouched.some((u) => u.trim() === now)) return line.slice(0, NOTE_MAX);
  return `${note.replace(/\s+$/, "")} ${line}`.slice(0, NOTE_MAX);
}

/** Why the note cannot be sent yet, or null. `openings` are the lines Orbit wrote. */
export function problemWithNote(note: string, openings: string[]): string | null {
  const now = note.trim();
  if (!now) return "Write a line about what you are asking for.";
  let own = now;
  for (const o of [...openings].sort((a, b) => b.length - a.length)) {
    const t = o.trim();
    if (t) own = own.split(t).join(" ");
  }
  return own.replace(/\s+/g, " ").trim().length < MIN_OWN ? "Add a few words of your own, so they know who is asking and why." : null;
}
