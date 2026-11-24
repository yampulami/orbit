import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export const looksLikeAddress = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/** A message from the server function's error body, or a fallback. */
async function problemOf(error: unknown, fallback: string): Promise<string> {
  try {
    const body = await (error as { context?: Response }).context?.json();
    if (body?.error) return String(body.error);
  } catch { /* no body */ }
  return fallback;
}

async function call(body: Record<string, unknown>, fallback: string): Promise<{ problem: string | null; data: unknown }> {
  if (!supabase) return { problem: "This needs an account on the server.", data: null };
  const { data, error } = await supabase.functions.invoke("backup-email", { body });
  if (error) return { problem: await problemOf(error, fallback), data: null };
  return { problem: null, data };
}

/** Sends a six digit code to the address. Resolves to a message to show, or null. */
export async function sendBackupCode(email: string, password: string): Promise<string | null> {
  return (await call({ action: "start", email: email.trim(), password }, "We could not send that. Try again in a moment.")).problem;
}

/** Checks the code; the address becomes a verified second email for the account. Resolves to a message to show, or null. */
export async function confirmBackupCode(code: string): Promise<string | null> {
  return (await call({ action: "confirm", code: code.trim() }, "That code did not work. Try again.")).problem;
}

export async function removeBackupEmail(password: string): Promise<string | null> {
  return (await call({ action: "remove", password }, "We could not remove it. Try again.")).problem;
}

/** After the school address is gone: the personal email becomes the account's main one. Resolves to a message to show, or null. */
export async function promoteBackupEmail(password: string): Promise<string | null> {
  return (await call({ action: "promote", password }, "We could not switch your email. Try again.")).problem;
}

/** The signed-in person's verified personal email, if they added one (only they can read it). `undefined` while loading. */
export function useBackupEmail(userId: string | undefined) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const reload = useCallback(async () => {
    if (!supabase || !userId) { setEmail(null); return; }
    const { data } = await supabase.from("private_contacts").select("backup_email").eq("user_id", userId).maybeSingle();
    setEmail((data as { backup_email: string } | null)?.backup_email ?? null);
  }, [userId]);
  useEffect(() => { void reload(); }, [reload]);
  return { email, reload };
}
