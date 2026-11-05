import { supabase } from "./supabase";

/** Confirming an email by a link that needs a button press. Many school and company mail systems open every link in a new email to check it, which
 *  would use up a one-time link before the person ever sees the email. So the email links to an Orbit page; that page only loads, and the account is
 *  confirmed when the person presses its button. A scanner can open the page but does not press the button. */
export type ConfirmParams = { tokenHash: string; type: "email" | "signup" };

/** Pure: what the link carries, or null if it is missing or odd. */
export function readConfirmParams(search: string): ConfirmParams | null {
  const q = new URLSearchParams(search);
  const tokenHash = (q.get("token_hash") ?? "").trim();
  const type = q.get("type");
  if (!/^[A-Za-z0-9_\-]{8,200}$/.test(tokenHash)) return null;
  return { tokenHash, type: type === "signup" ? "signup" : "email" };
}

/** Pure: a plain-words reason for a failed confirmation. */
export function confirmProblem(message: string): string {
  if (/expired|invalid|not found|already/i.test(message)) return "This link has already been used or has expired. If you already confirmed your email, just log in. If not, sign up again and we will send a new link.";
  if (/rate|too many|seconds/i.test(message)) return "Too many tries. Wait a minute, then press the button again.";
  return "We could not confirm your account. Try the button again, or sign up again to get a new link.";
}

/** Confirm the account. On success the person is signed in. Resolves to a message to show, or null. */
export async function confirmWithToken(p: ConfirmParams): Promise<string | null> {
  if (!supabase) return "Confirming an account needs the live app.";
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: p.tokenHash, type: p.type });
  if (error || !data.session) return confirmProblem(error?.message ?? "");
  return null;
}
