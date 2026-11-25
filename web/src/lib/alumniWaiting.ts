import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { ALUMNI_CHANGED } from "./alumni";

/** How many introduction requests are waiting for your answer. `tick` is anything that changes when something new arrives (the bell's count). */
export function useWaitingIntros(me: string | undefined, tick: number): number {
  const [n, setN] = useState(0);
  const [again, setAgain] = useState(0);
  useEffect(() => {
    const f = () => setAgain((x) => x + 1);
    window.addEventListener(ALUMNI_CHANGED, f);
    return () => window.removeEventListener(ALUMNI_CHANGED, f);
  }, []);
  useEffect(() => {
    let alive = true;
    if (!supabase || !me) { setN(0); return; }
    void supabase.from("alumni_requests").select("id", { count: "exact", head: true }).eq("to_user", me).eq("status", "pending").then(({ count }) => { if (alive) setN(count ?? 0); });
    return () => { alive = false; };
  }, [me, tick, again]);
  return n;
}
