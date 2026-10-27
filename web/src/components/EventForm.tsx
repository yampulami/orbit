import { eventActions, problemWithEvent, type Role } from "../lib/campusEvents";
import { eventsNeedApproval, useCampusOrgs, type Org } from "../lib/campusOrgs";
import { notice } from "../lib/notice";
import Converse, { CvChips, CvInput, CvText, type Step } from "./Converse";
import DateTimeField from "./DateTimeField";

type S = { title: string; startsAt: string; endsAt: string; place: string; description: string; cohosts: string[] };
const start: S = { title: "", startsAt: "", endsAt: "", place: "", description: "", cohosts: [] };
const pad = (n: number) => String(n).padStart(2, "0");
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const at = (d: Date, h: number, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };

/** Quick answers for "when": tonight, tomorrow evening, the weekend, next week. Only the ones still in the future. */
export function quickTimes(now: Date): { label: string; value: string }[] {
  const tonight = at(now, 19);
  const tomorrow = at(new Date(now.getTime() + 86400000), 18);
  const sat = new Date(now); sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7 || 7));
  const next = at(new Date(now.getTime() + 7 * 86400000), 18);
  return [
    ...(tonight.getTime() > now.getTime() + 30 * 60000 ? [{ label: "Tonight, 7 PM", value: local(tonight) }] : []),
    { label: "Tomorrow, 6 PM", value: local(tomorrow) },
    { label: "This weekend", value: local(at(sat, 14)) },
    { label: "Next week", value: local(next) },
  ];
}

/** Posting an event, one question at a time. A club's event is posted from inside the club (`org`); a staff host posts as themselves. It says plainly whether
 *  the event goes live at once or waits for a coordinator. */
export default function EventForm({ org, hostLabel, role, onDone }: { org?: Org; hostLabel?: string | null; role?: Role | null; onDone: () => void }) {
  const { orgs } = useCampusOrgs();
  // Clubs and offices that can be asked to co-host: running, not a circle, and not this club.
  const candidates = orgs.filter((o) => o.status === "active" && o.kind !== "circle" && o.id !== org?.id);
  const waits = org ? eventsNeedApproval(org) : role === "student";
  const official = org ? org.kind === "official" : !waits;
  const now = new Date();
  const quick = quickTimes(now);
  const nowLocal = local(now);

  const steps: Step<S>[] = [
    { id: "title", ask: "What is happening?", hint: "A short name people will recognise.", check: (s) => (s.title.trim() ? null : "Give it a title."),
      render: (s, set, go) => <CvInput label="Title" value={s.title} onChange={(v) => set({ title: v })} go={go} maxLength={120} placeholder="Open build night" /> },
    { id: "when", ask: "When is it?", hint: "Tap a time, or pick your own.", check: (s) => problemWithEvent({ title: s.title || "x", startsAt: s.startsAt, endsAt: s.endsAt || undefined }),
      render: (s, set) => (
        <>
          <CvChips label="Quick times" options={quick.map((q) => q.label)} value={quick.find((q) => q.value === s.startsAt)?.label ?? ""} onChange={(v) => set({ startsAt: quick.find((q) => q.label === v)?.value ?? "" })} />
          <div className="cv-pair">
            <DateTimeField label="Starts" value={s.startsAt} min={nowLocal} onChange={(v) => set({ startsAt: v })} />
            <DateTimeField label="Ends (optional)" value={s.endsAt} min={s.startsAt || nowLocal} optional placeholder="No end time" onChange={(v) => set({ endsAt: v })} />
          </div>
        </>) },
    { id: "where", ask: "Where?", hint: "A building, a room, or the lawn.", optional: true, empty: (s) => !s.place.trim(),
      render: (s, set, go) => <CvInput label="Place" value={s.place} onChange={(v) => set({ place: v })} go={go} maxLength={120} placeholder="Engineering lab" /> },
    { id: "details", ask: "Anything people should know?", hint: "Who it is for, what to bring.", optional: true, empty: (s) => !s.description.trim(),
      render: (s, set, go) => <CvText label="Details" rows={3} value={s.description} onChange={(v) => set({ description: v })} go={go} maxLength={1000} placeholder="No experience needed. Snacks provided." /> },
    ...(candidates.length > 0 ? [{ id: "cohosts", ask: "Co-host with another club?", hint: "They are asked first. Once a club says yes, the event shows under both clubs. Up to three.", optional: true, empty: (s: S) => s.cohosts.length === 0,
      render: (s: S, set: (p: Partial<S>) => void) => <CvChips label="Clubs" multi max={3} options={candidates.map((o) => o.name)} value={s.cohosts.map((id) => candidates.find((o) => o.id === id)?.name ?? "")} onChange={(v) => set({ cohosts: (v as string[]).map((n) => candidates.find((o) => o.name === n)?.id ?? "").filter(Boolean) })} /> }] : []),
  ];

  const summary = (s: S): [string, string, string][] => [
    ["Event", s.title, "title"],
    ["When", s.startsAt ? `${new Date(s.startsAt).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}, ${new Date(s.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}${s.endsAt ? ` to ${new Date(s.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}` : "", "when"],
    ["Where", s.place, "where"], ["Details", s.description, "details"],
    ["Co-hosts", s.cohosts.map((id) => candidates.find((o) => o.id === id)?.name).filter(Boolean).join(", "), "cohosts"],
    ["Posting as", `${org?.name ?? hostLabel ?? "host"}, ${official ? "Official campus event" : "Student event"}`, "title"],
  ];

  async function submit(s: S): Promise<string | null> {
    const r = await eventActions.create({ title: s.title, description: s.description, place: s.place, startsAt: s.startsAt, endsAt: s.endsAt || undefined, orgId: org?.id, orgName: org?.name, orgKind: org?.kind === "official" ? "official" : "student", orgTrusted: org?.trusted, cohosts: s.cohosts });
    if (r.error) return r.error;
    notice.show(r.status === "pending"
      ? { icon: "calendar", title: "Sent for approval", message: "A coordinator will look at it and you will get a notification. Until then only your club's officers and the coordinators can see it.", ms: 6500 }
      : { icon: "calendar", title: "Event posted", message: official ? "It is live as an Official campus event, and everyone on campus has it in their bell." : "It is live as a Student event, and everyone on campus has it in their bell.", ms: 4500 });
    onDone();
    return null;
  }

  return <Converse<S> title="New event" steps={steps} initial={start} summary={summary} submitLabel={waits ? "Send for approval" : "Post event"} note={waits ? "A coordinator approves new events from this club before other students see them." : "This goes live right away, and everyone on your campus is told."} onSubmit={submit} onCancel={onDone} />;
}
