import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { demoAuth, demoSession, isGuestEmail } from "./demoAuth";
import { looksLikeEmail } from "./username";

const NOT_RIGHT = "That username, email or password is not right.";

/** Sign in by username through the server function (it looks the email up privately; the app never sees it). Resolves to a message, or null on success. */
async function signInWithUsername(identifier: string, password: string): Promise<string | null> {
  const { data, error } = await supabase!.functions.invoke("sign-in", { body: { identifier, password } });
  if (error) {
    let body: { error?: string; message?: string; code?: string } = {};
    try { body = await (error as unknown as { context?: Response }).context?.json() ?? {}; } catch { /* no body */ }
    if (body.code === "NOT_FOUND" || /not found/i.test(body.message ?? "")) return "Signing in with a username is not switched on yet. Use your email for now.";
    if (body.error) return body.error;
    // No answer from our function at all (not deployed yet, or no connection): say so, rather than claiming the password was wrong.
    if ((error as { name?: string }).name !== "FunctionsHttpError") return "We could not reach the sign in service. Use your email, or try again in a moment.";
    return NOT_RIGHT;
  }
  const tokens = data as { access_token?: string; refresh_token?: string } | null;
  if (!tokens?.access_token || !tokens.refresh_token) return NOT_RIGHT;
  const { error: setError } = await supabase!.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
  return setError ? NOT_RIGHT : null;
}

/** `demo` is true when there is no backend: accounts then live on this device (see demoAuth). */
type Ctx = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  demo: boolean;
  /** Make an account. With a database, `username` is kept with the account and used when onboarding finishes. */
  signUp: (email: string, password: string, username?: string) => Promise<string | null>;
  /** Sign in with an email, or (with a database) a username, and a password. */
  signIn: (identifier: string, password: string) => Promise<string | null>;
  /** Try Orbit without an account. Each guest starts onboarding from scratch. Resolves to an error message, or null on success. */
  signInGuest: () => Promise<string | null>;
  /** Signing out also deletes a guest account, because a guest has no password to come back with. */
  signOut: () => Promise<void>;
  /** Delete this account and everything tied to it. Resolves to a message to show if it did not work, or null once it is gone. */
  deleteAccount: () => Promise<string | null>;
  /** Re-read the signed-in person, for example after their name changed. */
  refresh: () => void;
};
const noop = async () => null;
const AuthCtx = createContext<Ctx>({ session: null, loading: true, configured: false, demo: true, signUp: noop, signIn: noop, signInGuest: noop, signOut: async () => {}, deleteAccount: async () => null, refresh: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const demo = !supabase;
  const [session, setSession] = useState<Session | null>(() => (demo ? demoSession() : null));
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string, username?: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/login`, data: username ? { username } : undefined } });
      return error ? error.message : null;
    }
    const r = await demoAuth.signUp(email, password);
    if (r.ok) setSession(r.session);
    return r.ok ? null : r.error;
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const email = identifier.trim();
    if (supabase) {
      if (!looksLikeEmail(email)) return signInWithUsername(email, password);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    }
    const r = await demoAuth.signIn(email, password);
    if (r.ok) setSession(r.session);
    return r.ok ? null : r.error;
  }, []);

  const signInGuest = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.signInAnonymously();
      return error ? "Guest sign-in is not turned on for this project. In Supabase, open Authentication, then Sign In / Providers, and enable Anonymous sign-ins." : null;
    }
    const r = await demoAuth.guest();
    if (r.ok) setSession(r.session);
    return r.ok ? null : r.error;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      // A guest cannot sign back in, so leaving would only strand an account on the server. Remove it (best effort: leaving always works).
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.is_anonymous) await supabase.rpc("delete_my_account").then(() => undefined, () => undefined);
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    } else {
      const u = demoSession()?.user;
      if (u && isGuestEmail(u.email)) demoAuth.remove(u.id); else demoAuth.signOut();
    }
    setSession(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const id = session?.user.id;
    if (!id) return "Sign in first.";
    if (supabase) {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) return /function|schema cache|could not find/i.test(error.message) ? "Deleting accounts is not switched on for this project yet." : error.message;
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      try { localStorage.removeItem(`orbit-profile-v1:${id}`); } catch { /* ignore */ }
    } else {
      demoAuth.remove(id);
    }
    setSession(null);
    return null;
  }, [session]);

  const refresh = useCallback(() => { if (demo) setSession(demoSession()); else supabase?.auth.getSession().then(({ data }) => setSession(data.session)); }, [demo]);

  return <AuthCtx.Provider value={{ session, loading, configured: true, demo, signUp, signIn, signInGuest, signOut, deleteAccount, refresh }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
