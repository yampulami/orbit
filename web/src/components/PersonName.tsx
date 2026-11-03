import { useLiveName } from "../lib/directory";

/** A person's name, kept current: if they rename themselves, it changes here at once. `fallback` is the name saved with the post, comment or message. */
export default function PersonName({ id, fallback }: { id?: string; fallback: string }) {
  return <>{useLiveName(id, fallback)}</>;
}
