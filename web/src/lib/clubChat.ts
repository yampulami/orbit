import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { loadNames, watchTables } from "./people";
import { currentUserId } from "./campusOrgs";
import { notice } from "./notice";

/** Club chat: channels like a small Discord server. Every running club has #general; people with the "manage channels" permission add more, including
 *  team-only ones. Only the club's own people can read and write (the database enforces it). Unread dots come from a per-person read marker. */
export type RawChannel = { id: string; org_id: string; name: string; description: string; team_only: boolean; is_default: boolean; position: number; pod_id?: string | null };
export type RawMsg = { id: string; channel_id: string; org_id: string; author_id: string; body: string; created_at: string };
export type RawRead = { channel_id: string; last_read_at: string };
export type Channel = { id: string; name: string; description: string; teamOnly: boolean; isDefault: boolean; podId?: string; unread: number; lastAt?: string };
export type Message = { id: string; authorId: string; author: string; body: string; at: string; mine: boolean };

/** Pure: what the user typed, as a channel name (lower case, letters, numbers and dashes). */
export function channelSlug(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
}
export function problemWithChannel(name: string, existing: string[]): string | null {
  const slug = channelSlug(name);
  if (!slug) return "Give the channel a name with letters or numbers.";
  if (existing.includes(slug)) return "There is already a channel with that name.";
  return null;
}

/** Pure: rows in, what the screen shows. Default channel first, then in order; unread counts what others wrote after your read marker. */
export function buildChannels(channels: RawChannel[], messages: RawMsg[], reads: RawRead[], me: string): Channel[] {
  return [...channels]
    .sort((a, b) => (a.is_default === b.is_default ? a.position - b.position || a.name.localeCompare(b.name) : a.is_default ? -1 : 1))
    .map((c) => {
      const mine = messages.filter((m) => m.channel_id === c.id);
      const readAt = reads.find((r) => r.channel_id === c.id)?.last_read_at ?? "";
      return {
        id: c.id, name: c.name, description: c.description, teamOnly: c.team_only, isDefault: c.is_default, podId: c.pod_id ?? undefined,
        unread: mine.filter((m) => m.author_id !== me && m.created_at > readAt).length,
        lastAt: mine.reduce<string | undefined>((a, m) => (!a || m.created_at > a ? m.created_at : a), undefined),
      };
    });
}
export function buildMessages(messages: RawMsg[], channelId: string, names: Record<string, string>, me: string): Message[] {
  return messages.filter((m) => m.channel_id === channelId).sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => ({ id: m.id, authorId: m.author_id, author: m.author_id === me ? "You" : names[m.author_id] ?? "Member", body: m.body, at: m.created_at, mine: m.author_id === me }));
}

/* ---------- store ---------- */
const live = !!supabase;
const DEMO_KEY = "orbit-demo-club-chat";
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
type Demo = { channels: RawChannel[]; messages: RawMsg[]; reads: RawRead[] };
const demoStart = (): Demo => ({
  channels: [
    { id: "ch1", org_id: "o1", name: "general", description: "Everyone in the club", team_only: false, is_default: true, position: 0 },
    { id: "ch2", org_id: "o1", name: "build-night", description: "Parts, plans and who is bringing snacks", team_only: false, is_default: false, position: 1 },
    { id: "ch3", org_id: "o1", name: "officers", description: "Team only", team_only: true, is_default: false, position: 2 },
    { id: "ch-pd1", org_id: "o1", name: "pod-competition-team", description: "Building the regional competition robot", team_only: false, is_default: false, position: 3, pod_id: "pd1" },
    { id: "ch-pd2", org_id: "o1", name: "pod-beginners", description: "New to robotics? Start here", team_only: false, is_default: false, position: 4, pod_id: "pd2" },
  ],
  messages: [
    { id: "m1", channel_id: "ch1", org_id: "o1", author_id: "demo-riley", body: "Welcome to the club chat! Say hi.", created_at: ago(30 * 3600_000) },
    { id: "m2", channel_id: "ch1", org_id: "o1", author_id: "demo-sam", body: "Build night is Thursday this week, same room.", created_at: ago(5 * 3600_000) },
    { id: "m3", channel_id: "ch2", org_id: "o1", author_id: "demo-maya", body: "I can bring the soldering kit.", created_at: ago(3 * 3600_000) },
    { id: "m4", channel_id: "ch2", org_id: "o1", author_id: "demo-sam", body: "Perfect. I will grab extra batteries.", created_at: ago(2 * 3600_000) },
    { id: "m5", channel_id: "ch3", org_id: "o1", author_id: "demo-sam", body: "Budget check before Thursday?", created_at: ago(4 * 3600_000) },
  ],
  reads: [{ channel_id: "ch1", last_read_at: ago(24 * 3600_000) }],
});
const DEMO_NAMES: Record<string, string> = { "demo-sam": "Sam", "demo-riley": "Riley", "demo-maya": "Maya" };

/** Demo only: a pod made in the demo gets its channel (and loses it when the pod is deleted). The real database does this itself. */
export function addDemoPodChannel(orgId: string, podId: string, name: string, about: string) {
  const d = readDemo();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
  d.channels.push({ id: `ch-${podId}`, org_id: orgId, name: `pod-${slug}`, description: about, team_only: false, is_default: false, position: d.channels.length, pod_id: podId });
  writeDemo(d);
}
export function removeDemoPodChannel(podId: string) {
  const d = readDemo();
  d.channels = d.channels.filter((c) => c.pod_id !== podId);
  d.messages = d.messages.filter((m) => d.channels.some((c) => c.id === m.channel_id));
  writeDemo(d);
}
const readDemo = (): Demo => { try { const s = localStorage.getItem(DEMO_KEY); if (s) return JSON.parse(s) as Demo; } catch { /* none saved */ } return demoStart(); };
const writeDemo = (d: Demo) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); } catch { /* ignore */ } };
const fail = (m: string) => { notice.show({ icon: "alert", title: "That did not work", message: m }); return m; };

/** One club's chat: its channels (with unread counts), the messages, and the actions. Messages arrive live. */
export function useClubChat(orgId: string, enabled = true) {
  const [channels, setChannels] = useState<RawChannel[]>([]);
  const [messages, setMessages] = useState<RawMsg[]>([]);
  const [reads, setReads] = useState<RawRead[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const mount = useRef(0);
  const me = currentUserId() ?? "";

  const load = useCallback(async () => {
    const id = mount.current;
    if (!live) {
      const d = readDemo();
      // A club or circle made in the demo gets its #general the first time its chat opens.
      if (!d.channels.some((c) => c.org_id === orgId)) { d.channels.push({ id: crypto.randomUUID(), org_id: orgId, name: "general", description: "Everyone in the club", team_only: false, is_default: true, position: 0 }); writeDemo(d); }
      setChannels(d.channels.filter((c) => c.org_id === orgId)); setMessages(d.messages.filter((m) => m.org_id === orgId)); setReads(d.reads); setNames(DEMO_NAMES); setReady(true);
      return;
    }
    try {
      const withPod = await supabase!.from("campus_club_channels").select("id,org_id,name,description,team_only,is_default,position,pod_id").eq("org_id", orgId).order("position", { ascending: true }).limit(40);
      // Before the pods migration is applied the pod_id column is missing: ask for the plain list.
      const ch: { data: unknown[] | null; error: unknown } = withPod.error ? await supabase!.from("campus_club_channels").select("id,org_id,name,description,team_only,is_default,position").eq("org_id", orgId).order("position", { ascending: true }).limit(40) : withPod;
      // Before the channels migration is applied the table is missing: show no channels, never an error.
      if (ch.error) { if (id === mount.current) { setChannels([]); setMessages([]); setReady(true); } return; }
      const chans = (ch.data ?? []) as RawChannel[];
      const ids = chans.map((c) => c.id);
      const [m, r] = await Promise.all([
        ids.length ? supabase!.from("campus_club_messages").select("id,channel_id,org_id,author_id,body,created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(400) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase!.from("campus_club_channel_reads").select("channel_id,last_read_at").in("channel_id", ids) : Promise.resolve({ data: [], error: null }),
      ]);
      const msgs = (m.data ?? []) as RawMsg[];
      const nm = await loadNames(msgs.map((x) => x.author_id)).catch(() => ({}));
      if (id !== mount.current) return;
      setChannels(chans); setMessages(msgs); setReads((r.data ?? []) as RawRead[]); setNames(nm); setReady(true);
    } catch { /* keep what is on screen */ }
  }, [orgId]);

  useEffect(() => {
    if (!enabled) return;
    mount.current++;
    setReady(false);
    void load();
    const stop = live
      ? watchTables(`orbit-clubchat-${orgId}`, ["campus_club_messages", "campus_club_channels"], () => void load(), (e) => {
          if (e.table !== "campus_club_messages") return false;
          const r = (e.type === "DELETE" ? e.old : e.row) as Partial<RawMsg>;
          if (r.org_id && r.org_id !== orgId) return true; // another club's message: nothing to do here
          if (e.type === "DELETE") { if (!r.id) return false; setMessages((l) => l.filter((x) => x.id !== r.id)); return true; }
          if (!r.id || !r.channel_id || !r.author_id || !r.body || !r.created_at) return false;
          const row = r as RawMsg;
          setMessages((l) => (l.some((x) => x.id === row.id) ? l : [...l, row]));
          void loadNames([row.author_id]).then((n) => setNames((p) => ({ ...p, ...n }))).catch(() => undefined);
          return true;
        })
      : () => undefined;
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
    send: async (channelId: string, body: string) => {
      const text = body.trim().slice(0, 2000);
      if (!text) return null;
      // Shown at once for the sender; the live feed then confirms it (a duplicate is ignored by id).
      const row: RawMsg = { id: crypto.randomUUID(), channel_id: channelId, org_id: orgId, author_id: me, body: text, created_at: new Date().toISOString() };
      if (!live) { const d = readDemo(); d.messages.push(row); writeDemo(d); setMessages((l) => [...l, row]); return null; }
      setMessages((l) => [...l, row]);
      const { error } = await supabase!.from("campus_club_messages").insert({ id: row.id, channel_id: channelId, author_id: me, body: text });
      if (error) { setMessages((l) => l.filter((x) => x.id !== row.id)); return fail(error.message); }
      return null;
    },
    createChannel: (name: string, about: string, teamOnly: boolean) => {
      const bad = problemWithChannel(name, channels.map((c) => c.name)); if (bad) return Promise.resolve(bad);
      const slug = channelSlug(name);
      return run((d) => { d.channels.push({ id: crypto.randomUUID(), org_id: orgId, name: slug, description: about.trim().slice(0, 120), team_only: teamOnly, is_default: false, position: d.channels.filter((c) => c.org_id === orgId).length }); },
        () => Promise.resolve(supabase!.rpc("create_channel", { org: orgId, channel_name: name, about: about.trim(), only_team: teamOnly })));
    },
    deleteChannel: (id: string) => run((d) => { d.channels = d.channels.filter((c) => c.id !== id); d.messages = d.messages.filter((m) => m.channel_id !== id); }, () => Promise.resolve(supabase!.rpc("delete_channel", { ch: id }))),
    deleteMessage: (id: string) => run((d) => { d.messages = d.messages.filter((m) => m.id !== id); }, () => Promise.resolve(supabase!.from("campus_club_messages").delete().eq("id", id))),
    markRead: (channelId: string) => {
      const now = new Date().toISOString();
      setReads((l) => [...l.filter((r) => r.channel_id !== channelId), { channel_id: channelId, last_read_at: now }]);
      if (!live) { const d = readDemo(); d.reads = [...d.reads.filter((r) => r.channel_id !== channelId), { channel_id: channelId, last_read_at: now }]; writeDemo(d); return; }
      if (me) void Promise.resolve(supabase!.from("campus_club_channel_reads").upsert({ channel_id: channelId, user_id: me, last_read_at: now })).catch(() => undefined);
    },
  };

  const list = buildChannels(channels, messages, reads, me);
  return { reload: load, channels: list, messagesIn: (channelId: string) => buildMessages(messages, channelId, names, me), unread: list.reduce((n, c) => n + c.unread, 0), ready, actions };
}
