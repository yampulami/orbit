import { supabase } from "./supabase";
import { clearAttempts, countAttempt, limitLeft, waitMessage } from "./attemptLimit";

const TEN = 10 * 60_000;

/** Forgot password: an email with a short code, then the code plus a new password. Needs a database; in demo mode there is no email to send. */
export const resetAvailable = !!supabase;
export const MIN_PASSWORD = 8;

/** Reset codes are numbers, 6 to 10 digits depending on the project's setting. */
export const validCode = (s: string) => /^\d{6,10}$/.test(s.trim());

/** A message for a bad new password, or null if it is fine. */
export function checkNewPassword(password: string, again: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password !== again) return "The two passwords are not the same.";
  return null;
}

/** Supabase waits at most 10 seconds for the mail server to take the message and answers "timed out" (504) if it is slower, but the message is still
 *  sent. Gmail is often that slow. So a timeout means "probably sent", not "failed". Other errors (a refused message, a bad address) still count as failures. */
export function timedOutButSent(error: { status?: number; code?: string; message?: string }): boolean {
  return error.status === 504 || error.code === "request_timeout" || /request_timeout|deadline exceeded/i.test(error.message ?? "");
}

/** Email a reset code. It says the same thing whether or not that address has an account, so it cannot be used to find out who is on Orbit.
 *  Resolves to a message to show if it could not be sent, or null. */
export async function sendResetCode(email: string): Promise<string | null> {
  if (!supabase) return "Resetting a password needs an account on the server.";
  // a few codes per address, and a few addresses per browser, every ten minutes
  const who = "reset-send:" + email.trim().toLowerCase();
  const left = Math.max(limitLeft(who, 3, TEN), limitLeft("reset-send", 6, TEN));
  if (left) return waitMessage(left);
  countAttempt(who, TEN); countAttempt("reset-send", TEN);
  // If this is an account's verified personal email, the server sends the code there (it says the same thing either way).
  void supabase.functions.invoke("backup-email", { body: { action: "reset-start", email: email.trim() } }).catch(() => undefined);
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (!error) return null;
  if (timedOutButSent(error)) return null;
  if (/rate|seconds|too many|limit/i.test(error.message)) return "Please wait a minute, then ask for another code.";
  return "We could not send that. Check the email address and try again.";
}

/** Check the code and set the new password. On success the person is signed in. Resolves to a message to show, or null. */
export async function resetWithCode(email: string, code: string, password: string): Promise<string | null> {
  if (!supabase) return "Resetting a password needs an account on the server.";
  // five wrong codes and it waits: the code is a short number, so guessing it has to be slow
  const who = "reset-code:" + email.trim().toLowerCase();
  const left = limitLeft(who, 5, TEN);
  if (left) return waitMessage(left);
  const verified = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "recovery" });
  if (verified.error || !verified.data.session) {
    // The code may have gone to a personal email: the server checks it, sets the password and returns a session.
    const viaPersonal = await supabase.functions.invoke("backup-email", { body: { action: "reset-finish", email: email.trim(), code: code.trim(), password } });
    const t = viaPersonal.data as { access_token?: string; refresh_token?: string } | null;
    if (!viaPersonal.error && t?.access_token && t.refresh_token) {
      const set = await supabase.auth.setSession({ access_token: t.access_token, refresh_token: t.refresh_token });
      if (!set.error) { clearAttempts(who); return null; }
    }
    countAttempt(who, TEN);
    return "That code is not right, or it has expired. Ask for a new one.";
  }
  clearAttempts(who);
  return savePassword(password);
}

async function savePassword(password: string): Promise<string | null> {
  const { error } = await supabase!.auth.updateUser({ password });
  if (error) return /different|same/i.test(error.message) ? "Choose a password you have not used before." : error.message || "We could not save the new password. Try again.";
  return null;
}

/** Change the password while signed in. The current password is checked first, so someone at an unlocked device cannot lock the owner out.
 *  Resolves to a message to show, or null on success. */
export async function changePassword(email: string, current: string, next: string): Promise<string | null> {
  if (!supabase) return "Changing a password needs an account on the server.";
  const check = await supabase.auth.signInWithPassword({ email: email.trim(), password: current });
  if (check.error) return /rate|too many/i.test(check.error.message) ? "Too many tries. Please wait a minute." : "Your current password is not right.";
  return savePassword(next);
}
