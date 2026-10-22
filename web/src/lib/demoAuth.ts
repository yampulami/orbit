import type { Session } from "@supabase/supabase-js";
import { loadProfile } from "./profile";

/** Accounts for demo mode (no Supabase): saved on this device only, so the sign up, onboarding and sign out flow can be shown without a backend.
 *  Passwords are salted and hashed even here, and this must never be used for real accounts. */
type Account = { id: string; email: string; name: string; salt: string; hash: string };

const ACCOUNTS = "orbit-demo-accounts-v1";
const SESSION = "orbit-demo-session";
export const DEMO_CAMPUS = "orbit-demo-campus";

const read = (): Account[] => { try { return JSON.parse(localStorage.getItem(ACCOUNTS) ?? "[]") as Account[]; } catch { return []; } };
const write = (a: Account[]) => { try { localStorage.setItem(ACCOUNTS, JSON.stringify(a)); } catch { /* storage unavailable */ } };

async function digest(salt: string, password: string) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Guests use this address ending, so the rest of the app can tell them apart. */
export const GUEST_DOMAIN = "@guest.orbit";
export const isGuestEmail = (email?: string | null) => !!email && email.endsWith(GUEST_DOMAIN);

const toSession = (a: Account): Session => ({ user: { id: a.id, email: a.email, user_metadata: { name: a.name } } } as unknown as Session);

/** The signed-in demo account, if any. */
export function demoSession(): Session | null {
  try {
    const id = localStorage.getItem(SESSION);
    const a = id ? read().find((x) => x.id === id) : undefined;
    return a ? toSession(a) : null;
  } catch { return null; }
}

/** Each account's own university is what the rest of the app reads while it is signed in. */
function adopt(a: Account) {
  try {
    localStorage.setItem(SESSION, a.id);
    const p = loadProfile(a.id);
    if (p?.campusName) localStorage.setItem(DEMO_CAMPUS, p.campusName); else localStorage.removeItem(DEMO_CAMPUS);
  } catch { /* ignore */ }
}

export type DemoResult = { ok: true; session: Session } | { ok: false; error: string };

export const demoAuth = {
  async signUp(email: string, password: string): Promise<DemoResult> {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return { ok: false, error: "Enter a valid email address." };
    if (password.length < 8) return { ok: false, error: "Use at least 8 characters for the password." };
    const all = read();
    if (all.some((a) => a.email === e)) return { ok: false, error: "That email already has an account. Sign in instead." };
    const salt = crypto.randomUUID();
    const a: Account = { id: crypto.randomUUID(), email: e, name: e.split("@")[0], salt, hash: await digest(salt, password) };
    write([...all, a]);
    adopt(a);
    return { ok: true, session: toSession(a) };
  },
  async signIn(email: string, password: string): Promise<DemoResult> {
    const e = email.trim().toLowerCase();
    const a = read().find((x) => x.email === e);
    if (!a || (await digest(a.salt, password)) !== a.hash) return { ok: false, error: "That email and password do not match an account." };
    adopt(a);
    return { ok: true, session: toSession(a) };
  },
  /** A throwaway account, so onboarding can be tried again and again. Earlier guests are removed along with their saved answers. */
  async guest(): Promise<DemoResult> {
    const all = read();
    for (const g of all.filter((a) => isGuestEmail(a.email))) { try { localStorage.removeItem(`orbit-profile-v1:${g.id}`); } catch { /* ignore */ } }
    const salt = crypto.randomUUID();
    const a: Account = { id: crypto.randomUUID(), email: `guest-${crypto.randomUUID().slice(0, 8)}${GUEST_DOMAIN}`, name: "Guest", salt, hash: await digest(salt, crypto.randomUUID()) };
    write([...all.filter((x) => !isGuestEmail(x.email)), a]);
    adopt(a);
    return { ok: true, session: toSession(a) };
  },
  signOut() {
    try { localStorage.removeItem(SESSION); localStorage.removeItem(DEMO_CAMPUS); } catch { /* ignore */ }
  },
  /** Delete an account from this device, with its saved answers. */
  remove(id: string) {
    write(read().filter((a) => a.id !== id));
    try { localStorage.removeItem(`orbit-profile-v1:${id}`); localStorage.removeItem(SESSION); localStorage.removeItem(DEMO_CAMPUS); } catch { /* ignore */ }
  },
  setName(id: string, name: string) {
    write(read().map((a) => (a.id === id ? { ...a, name } : a)));
  },
};
