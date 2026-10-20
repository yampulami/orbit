import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, DEMO_BUILD } from "./supabase";

type Ctx = { session: Session | null; loading: boolean; configured: boolean };
const AuthCtx = createContext<Ctx>({ session: null, loading: true, configured: false });

const demoSession = { user: { id: "demo-user", email: "yami@caldwell.edu", user_metadata: { name: "Yami" } } } as unknown as Session;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(DEMO_BUILD ? demoSession : null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthCtx.Provider value={{ session, loading, configured: Boolean(supabase) || DEMO_BUILD }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
