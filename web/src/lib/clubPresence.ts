import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/** Who is looking at this club right now: people with its page open show as online in the members panel. Without a database only you are here. */
export function useClubPresence(orgId: string, uid: string | undefined, enabled: boolean): Set<string> {
  const [here, setHere] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!uid) { setHere(new Set()); return; }
    if (!enabled || !supabase || !orgId) { setHere(new Set([uid])); return; }
    const ch = supabase.channel(`club-here-${orgId}`, { config: { presence: { key: uid } } });
    const sync = () => setHere(new Set(Object.keys(ch.presenceState())));
    ch.on("presence", { event: "sync" }, sync).subscribe((status) => { if (status === "SUBSCRIBED") void ch.track({ at: Date.now() }); });
    return () => { void supabase?.removeChannel(ch); };
  }, [orgId, uid, enabled]);
  return here;
}
