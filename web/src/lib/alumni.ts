import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type OpenTo = "referrals" | "mentoring" | "chats" | "hiring";
export const OPEN_TO: OpenTo[] = ["referrals", "mentoring", "chats", "hiring"];
export const OPEN_LABEL: Record<OpenTo, string> = { referrals: "Referrals", mentoring: "Mentoring", chats: "Coffee chats", hiring: "Hiring" };

export type AlumFields = { gradYear: number; field: string; company: string; jobTitle: string; industry: string; about: string; openTo: OpenTo[]; listed: boolean };
export type Alum = AlumFields & { id: string; name: string };
export type Req = { id: string; otherId: string; other: string; note: string; status: "pending" | "accepted" | "declined"; at: string; decidedAt?: string; incoming: boolean };

/** Said to the rest of the app (the menu badge) when requests change. */
export const ALUMNI_CHANGED = "orbit-alumni";

type Row = { user_id: string; grad_year: number; field: string; company: string; job_title: string; industry: string; about: string; open_to: string[]; listed: boolean };
const fromRow = (r: Row): AlumFields => ({ gradYear: r.grad_year, field: r.field, company: r.company, jobTitle: r.job_title, industry: r.industry, about: r.about, openTo: (r.open_to ?? []).filter((x): x is OpenTo => (OPEN_TO as string[]).includes(x)), listed: r.listed });

/** Sample people for the demo, which has no database. */
const DEMO: Alum[] = [
  { id: "demo-a1", name: "Priya Shrestha", gradYear: 2024, field: "Computer Science", company: "Northwind Software", jobTitle: "Software Engineer", industry: "Technology", about: "Happy to look at resumes and tell you what the interviews were like.", openTo: ["referrals", "chats"], listed: true },
  { id: "demo-a2", name: "Daniel Okafor", gradYear: 2023, field: "Business", company: "Harbor Health", jobTitle: "Operations Analyst", industry: "Healthcare", about: "Ask me about getting into healthcare operations.", openTo: ["mentoring", "hiring"], listed: true },
  { id: "demo-a3", name: "Maya Lopez", gradYear: 2022, field: "Biology", company: "Brightpath Labs", jobTitle: "Research Associate", industry: "Biotech", about: "", openTo: ["chats"], listed: true },
];

const clean = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

/** Everything the Alumni page needs: the directory, your own listing, and the requests to and from you. */
export function useAlumni(me: string | undefined) {
  const [list, setList] = useState<Alum[]>([]);
  const [mine, setMine] = useState<AlumFields | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    if (!supabase || !me) { setList(DEMO); setReady(true); return; }
    const [dir, own, rq] = await Promise.all([
      supabase.from("alumni_profiles").select("user_id,grad_year,field,company,job_title,industry,about,open_to,listed").neq("user_id", me).order("grad_year", { ascending: false }).limit(300),
      supabase.from("alumni_profiles").select("user_id,grad_year,field,company,job_title,industry,about,open_to,listed").eq("user_id", me).maybeSingle(),
      supabase.from("alumni_requests").select("id,from_user,to_user,note,status,created_at,decided_at").neq("status", "withdrawn").order("created_at", { ascending: false }).limit(100),
    ]);
    // a failed read must not look like a campus with no graduates
    if (dir.error || rq.error) { setFailed(true); setReady(true); return; }
    setFailed(false);
    const rows = (dir.data ?? []) as Row[];
    const reqRows = (rq.data ?? []) as { id: string; from_user: string; to_user: string; note: string; status: Req["status"]; created_at: string; decided_at: string | null }[];
    const ids = [...new Set([...rows.map((r) => r.user_id), ...reqRows.flatMap((r) => [r.from_user, r.to_user])])].filter((x) => x !== me);
    const names = new Map<string, string>();
    if (ids.length) {
      const n = await supabase.from("student_profiles").select("user_id,display_name").in("user_id", ids);
      for (const p of (n.data ?? []) as { user_id: string; display_name: string }[]) names.set(p.user_id, p.display_name);
    }
    setList(rows.map((r) => ({ id: r.user_id, name: names.get(r.user_id) ?? "A graduate", ...fromRow(r) })));
    setMine(own.data ? fromRow(own.data as Row) : null);
    setReqs(reqRows.map((r) => {
      const incoming = r.to_user === me;
      const otherId = incoming ? r.from_user : r.to_user;
      return { id: r.id, otherId, other: names.get(otherId) ?? "A student", note: r.note, status: r.status, at: r.created_at, decidedAt: r.decided_at ?? undefined, incoming };
    }));
    setReady(true);
  }, [me]);
  useEffect(() => { void reload(); }, [reload]);

  /** Lists or updates your own entry. Resolves to a message to show, or null. */
  async function saveMine(f: AlumFields): Promise<string | null> {
    if (!supabase || !me) return "Alumni listings need an account on the server.";
    const ck = await supabase.from("student_profiles").select("campus_key").eq("user_id", me).maybeSingle();
    const campus = (ck.data as { campus_key: string } | null)?.campus_key;
    if (!campus) return "Finish setting up your profile first.";
    const year = Math.round(f.gradYear);
    if (!(year >= 1990 && year <= 2100)) return "Enter the year you graduate or graduated, for example 2027.";
    const { error } = await supabase.from("alumni_profiles").upsert({
      user_id: me, campus_key: campus, grad_year: year, field: clean(f.field, 80), company: clean(f.company, 80), job_title: clean(f.jobTitle, 80),
      industry: clean(f.industry, 60), about: clean(f.about, 300), open_to: f.openTo, listed: f.listed, updated_at: new Date().toISOString(),
    });
    if (error) return error.code === "22023" ? error.message : /row-level security/i.test(error.message) ? "Add a personal email in Profile first, so students can still reach you after school." : "That did not save. Try again.";
    await reload();
    return null;
  }

  async function removeMine(): Promise<string | null> {
    if (!supabase || !me) return null;
    const { error } = await supabase.from("alumni_profiles").delete().eq("user_id", me);
    if (error) return "That did not work. Try again.";
    await reload();
    return null;
  }

  /** Ask a graduate for an introduction. Resolves to a message to show, or null. */
  async function ask(target: string, note: string): Promise<string | null> {
    if (!supabase || !me) return "In the demo nothing is sent. With an account, the graduate gets your note.";
    const { error } = await supabase.rpc("ask_alumni_intro", { target, note_text: note });
    if (error) return error.message || "That did not send. Try again.";
    await reload();
    return null;
  }

  async function answer(id: string, accept: boolean): Promise<string | null> {
    if (!supabase || !me) return null;
    const { error } = await supabase.rpc("answer_alumni_intro", { req: id, accept });
    if (error) return error.message || "That did not work. Try again.";
    await reload();
    window.dispatchEvent(new CustomEvent(ALUMNI_CHANGED));
    return null;
  }

  /** Take back a request of yours that has not been answered. */
  async function withdraw(id: string): Promise<string | null> {
    if (!supabase || !me) return null;
    const { error } = await supabase.rpc("withdraw_alumni_intro", { req: id });
    if (error) return error.message || "That did not work. Try again.";
    await reload();
    return null;
  }

  return { list, mine, reqs, ready, failed, saveMine, removeMine, ask, answer, withdraw, reload };
}
