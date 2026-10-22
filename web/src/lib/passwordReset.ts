import { supabase } from "./supabase";

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

/** Email a reset code. It says the same thing whether or not that address has an account, so it cannot be used to find out who is on Orbit.
 *  Resolves to a message to show if it could not be sent, or null. */
export async function sendResetCode(email: string): Promise<string | null> {
  if (!supabase) return "Resetting a password needs an account on the server.";
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (!error) return null;
  if (/rate|seconds|too many|limit/i.test(error.message)) return "Please wait a minute, then ask for another code.";
  return "We could not send that. Check the email address and try again.";
}

/** Check the code and set the new password. On success the person is signed in. Resolves to a message to show, or null. */
export async function resetWithCode(email: string, code: string, password: string): Promise<string | null> {
  if (!supabase) return "Resetting a password needs an account on the server.";
  const verified = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "recovery" });
  if (verified.error || !verified.data.session) return "That code is not right, or it has expired. Ask for a new one.";
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return /different|same/i.test(error.message) ? "Choose a password you have not used before." : error.message || "We could not save the new password. Try again.";
  return null;
}
