import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { demoAuth, demoSession } from "./demoAuth";

/** `demo` is true when there is no backend: accounts then live on this device (see demoAuth). */
type Ctx = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  demo: boolean;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Try Orbit without an account. Each guest starts onboarding from scratch. Resolves to an error message, or null on success. */
  signInGuest: () => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Re-read the signed-in person, for example after their name changed. */
  refresh: () => void;
};
const noop = async () => null;
const AuthCtx = createContext<Ctx>({ session: null, loading: true, configured: false, demo: true, signUp: noop, signIn: noop, signInGuest: noop, signOut: async () => {}, refresh: () => {} });

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

  const signUp = useCallback(async (email: string, password: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/login` } });
      return error ? error.message : null;
    }
    const r = await demoAuth.signUp(email, password);
    if (r.ok) setSession(r.session);
    return r.ok ? null : r.error;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (supabase) {
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
    if (supabase) await supabase.auth.signOut();
    else demoAuth.signOut();
    setSession(null);
  }, []);

  const refresh = useCallback(() => { if (demo) setSession(demoSession()); else supabase?.auth.getSession().then(({ data }) => setSession(data.session)); }, [demo]);

  return <AuthCtx.Provider value={{ session, loading, configured: true, demo, signUp, signIn, signInGuest, signOut, refresh }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
