import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { loadNames, watchTables } from "./people";
import { currentUserId } from "./campusOrgs";
import { addDemoPodChannel, removeDemoPodChannel } from "./clubChat";
import { notice } from "./notice";

/** Pods: small interest groups inside a club (a photography club might have Portrait, Film and Street pods). A pod has members and its own private chat channel,
 *  without being a separate club. Anyone in the club can join at once; the people who manage channels create and delete pods. */
export type RawPod = { id: string; org_id: string; name: string; description: string };
export type RawPodMember = { pod_id: string; user_id: string };
export type Pod = { id: string; name: string; description: string; members: { id: string; name: string }[]; mine: boolean; channelId?: string };

/** Pure: rows in, what the screen shows. Pods you are in first, then by name. */
export function buildPods(pods: RawPod[], members: RawPodMember[], channels: { id: string; pod_id: string | null }[], names: Record<string, string>, me: string): Pod[] {
  return pods
    .map((p): Pod => {
      const ms = members.filter((m) => m.pod_id === p.id);
      return { id: p.id, name: p.name, description: p.description, mine: ms.some((m) => m.user_id === me), channelId: channels.find((c) => c.pod_id === p.id)?.id,
        members: ms.map((m) => ({ id: m.user_id, name: m.user_id === me ? "You" : names[m.user_id] ?? "Member" })).sort((a, b) => a.name.localeCompare(b.name)) };
    })
    .sort((a, b) => (a.mine === b.mine ? a.name.localeCompare(b.name) : a.mine ? -1 : 1));
}
export function problemWithPod(name: string, existing: string[]): string | null {
  const n = name.trim();
  if (!n) return "Give the pod a name.";
  if (n.length > 40) return "Keep the name under 40 characters.";
  if (!/[a-z0-9]/i.test(n)) return "Give the pod a name with letters or numbers.";
  if (existing.some((e) => e.trim().toLowerCase() === n.toLowerCase())) return "There is already a pod with that name.";
  return null;
}

/* ---------- store ---------- */
const live = !!supabase;
const DEMO_KEY = "orbit-demo-club-pods";
type Demo = { pods: RawPod[]; members: RawPodMember[] };
const demoStart = (): Demo => ({
  pods: [{ id: "pd1", org_id: "o1", name: "Competition team", description: "Building the regional competition robot" }, { id: "pd2", org_id: "o1", name: "Beginners", description: "New to robotics? Start here" }],
  members: [{ pod_id: "pd1", user_id: "demo-sam" }, { pod_id: "pd1", user_id: "demo-me" }, { pod_id: "pd2", user_id: "demo-riley" }],
});
const DEMO_NAMES: Record<string, string> = { "demo-sam": "Sam", "demo-riley": "Riley", "demo-maya": "Maya" };
const readDemo = (): Demo => { try { const s = localStorage.getItem(DEMO_KEY); if (s) return JSON.parse(s) as Demo; } catch { /* none */ } return demoStart(); };
const writeDemo = (d: Demo) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); } catch { /* ignore */ } };
const fail = (m: string) => { notice.show({ icon: "alert", title: "That did not work", message: m }); return m; };

/** One club's pods, with the actions to create, join, leave and delete them. */
export function useClubPods(orgId: string, enabled = true) {
  const [pods, setPods] = useState<Pod[]>([]);
  const [ready, setReady] = useState(false);
  const mount = useRef(0);
  const me = currentUserId() ?? "";

  const load = useCallback(async () => {
    const id = mount.current;
    if (!live) {
      const d = readDemo();
      const mine = d.pods.filter((p) => p.org_id === orgId);
      setPods(buildPods(mine, d.members, mine.map((p) => ({ id: `ch-${p.id}`, pod_id: p.id })), DEMO_NAMES, me));
      setReady(true);
      return;
    }
    try {
      const p = await supabase!.from("campus_club_pods").select("id,org_id,name,description").eq("org_id", orgId).limit(40);
      // Before the pods migration is applied the table is missing: no pods, never an error.
      if (p.error) { if (id === mount.current) { setPods([]); setReady(true); } return; }
      const rows = (p.data ?? []) as RawPod[];
      const ids = rows.map((r) => r.id);
      const [m, c] = await Promise.all([
        ids.length ? supabase!.from("campus_club_pod_members").select("pod_id,user_id").in("pod_id", ids).limit(3000) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase!.from("campus_club_channels").select("id,pod_id").eq("org_id", orgId).not("pod_id", "is", null) : Promise.resolve({ data: [], error: null }),
      ]);
      const members = (m.data ?? []) as RawPodMember[];
      const names = await loadNames(members.map((x) => x.user_id)).catch(() => ({}));
      if (id !== mount.current) return;
      setPods(buildPods(rows, members, (c.data ?? []) as { id: string; pod_id: string | null }[], names, me));
      setReady(true);
    } catch { /* keep what is on screen */ }
  }, [orgId, me]);

  useEffect(() => {
    if (!enabled) return;
    mount.current++;
    setReady(false);
    void load();
    const stop = live ? watchTables(`orbit-clubpods-${orgId}`, ["campus_club_pods", "campus_club_pod_members", "campus_club_channels"], () => void load()) : () => undefined;
    return () => { mount.current++; stop(); };
  }, [orgId, enabled, load]);

  const run = async (demo: (d: Demo) => void, remote: () => Promise<{ error: { message: string } | null }>): Promise<string | null> => {
    if (!me) return "Sign in first.";
    if (!live) { const d = readDemo(); demo(d); writeDemo(d); await load(); return null; }
    const { error } = await remote();
    if (error) return fail(error.message);
    await load();
    return null;
  };
  const actions = {
    create: (name: string, about: string) => {
      const bad = problemWithPod(name, pods.map((p) => p.name)); if (bad) return Promise.resolve(bad);
      return run((d) => {
        const id = crypto.randomUUID();
        d.pods.push({ id, org_id: orgId, name: name.trim(), description: about.trim().slice(0, 160) });
        d.members.push({ pod_id: id, user_id: me });
        addDemoPodChannel(orgId, id, name.trim(), about.trim().slice(0, 120));
      }, () => Promise.resolve(supabase!.rpc("create_pod", { org: orgId, pod_name: name.trim(), about: about.trim() })));
    },
    join: (podId: string) => run((d) => { if (!d.members.some((m) => m.pod_id === podId && m.user_id === me)) d.members.push({ pod_id: podId, user_id: me }); }, () => Promise.resolve(supabase!.rpc("join_pod", { pod: podId }))),
    leave: (podId: string) => run((d) => { d.members = d.members.filter((m) => !(m.pod_id === podId && m.user_id === me)); }, () => Promise.resolve(supabase!.rpc("leave_pod", { pod: podId }))),
    remove: (podId: string) => run((d) => { d.pods = d.pods.filter((p) => p.id !== podId); d.members = d.members.filter((m) => m.pod_id !== podId); removeDemoPodChannel(podId); }, () => Promise.resolve(supabase!.rpc("delete_pod", { pod: podId }))),
  };
  return { pods, ready, actions };
}
