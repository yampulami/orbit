import { spoken, useLiveName } from "../lib/directory";

/** A person's name, kept current: if they rename themselves, it changes here at once. `fallback` is the name saved with the post, comment or message
 *  (an email address there is shortened to the part before the @). */
export default function PersonName({ id, fallback }: { id?: string; fallback: string }) {
  return <>{spoken(useLiveName(id, fallback))}</>;
}
