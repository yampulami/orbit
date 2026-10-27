import { CATEGORIES, EMPTY_APP, orgActions, problemWithOrg, type Application, type OrgKind } from "../lib/campusOrgs";
import Converse, { CvChips, CvInput, CvText, type Step } from "./Converse";

type S = { name: string; purpose: string; category: string; advisorName: string; advisorEmail: string; meeting: string; size: string; firstEvent: string; contact: string; office: string; line: string };
const start: S = { name: "", purpose: "", category: "", advisorName: "", advisorEmail: "", meeting: "", size: "", firstEvent: "", contact: "", office: "", line: "" };
const nameStep = (what: string): Step<S> => ({ id: "name", ask: `What should we call ${what}?`, hint: "The name people will see.", check: (s) => (s.name.trim().length < 2 ? "Give it a name, at least 2 letters." : null),
  render: (s, set, go) => <CvInput label="Name" value={s.name} onChange={(v) => set({ name: v })} go={go} maxLength={80} placeholder="Chess Club" /> });

/** Starting a club, an office or a circle, one question at a time. Students apply (a coordinator reads the answers); coordinators set one up directly; a circle just starts. */
export default function ClubApplication({ reviewer, mode = "club", onSent, onCancel }: { reviewer: boolean; mode?: "club" | "circle"; onSent: (r: { id?: string; status?: string }) => void; onCancel: () => void }) {
  const circle = mode === "circle";
  const categoryStep: Step<S> = { id: "category", ask: circle ? "What is it about?" : "Which fits best?", hint: "Pick one so people can find it.", optional: true, empty: (s) => !s.category,
    render: (s, set) => <CvChips label="Category" options={CATEGORIES} value={s.category} onChange={(v) => set({ category: v as string })} /> };

  const steps: Step<S>[] = circle
    ? [
        nameStep("your circle"),
        { id: "line", ask: "What is it about, in a line?", hint: "Like a study group or a weekly run. Anyone can join it right away.", optional: true, empty: (s) => !s.line.trim(),
          render: (s, set, go) => <CvInput label="One line" value={s.line} onChange={(v) => set({ line: v })} go={go} maxLength={140} placeholder="Early morning runs around the lake" /> },
        categoryStep,
      ]
    : reviewer
      ? [
          nameStep("it"),
          { id: "line", ask: "What is it, in a line?", hint: "Shown on its page.", optional: true, empty: (s) => !s.line.trim(),
            render: (s, set, go) => <CvInput label="One line" value={s.line} onChange={(v) => set({ line: v })} go={go} maxLength={160} placeholder="Official events from the Student Life office" /> },
          { id: "office", ask: "Is it a club or a staff-run office?", hint: "A staff-run office posts Official campus events.", check: (s) => (s.office ? null : "Pick one."),
            render: (s, set) => <CvChips label="Kind" options={["Student club", "Staff-run office"]} value={s.office} onChange={(v) => set({ office: v as string })} /> },
        ]
      : [
          nameStep("your club"),
          { id: "purpose", ask: "What is it for, and who is it for?", hint: "A couple of sentences for the coordinator who decides.", check: (s) => (s.purpose.trim().length < 30 ? "Tell the coordinator a little more, a couple of sentences." : null),
            render: (s, set, go) => <CvText label="Purpose" value={s.purpose} onChange={(v) => set({ purpose: v })} go={go} maxLength={600} placeholder="We play casual games, run beginner lessons and hold a spring tournament. Everyone is welcome." /> },
          categoryStep,
          { id: "adviser", ask: "Who is your faculty or staff adviser?", hint: "Every club needs one. Their name and email.",
            check: (s) => (s.advisorName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(s.advisorEmail.trim()) ? "Add the adviser's name and a valid email." : null),
            render: (s, set, go) => (
              <div className="cv-pair">
                <CvInput label="Adviser name" value={s.advisorName} onChange={(v) => set({ advisorName: v })} placeholder="Dr. Rivera" maxLength={80} />
                <CvInput label="Adviser email" type="email" inputMode="email" autoFocus={false} value={s.advisorEmail} onChange={(v) => set({ advisorEmail: v })} go={go} placeholder="rivera@university.edu" maxLength={120} />
              </div>) },
          { id: "meeting", ask: "When and where will you meet?", hint: "It can change later.", check: (s) => (s.meeting.trim().length < 3 ? "Say where and when the club meets." : null),
            render: (s, set, go) => <CvInput label="Meeting time and place" value={s.meeting} onChange={(v) => set({ meeting: v })} go={go} maxLength={160} placeholder="Thursdays at 6 PM, Student Center room 204" /> },
          { id: "more", ask: "Anything else the coordinator should know?", hint: "How many people you expect, and a first event you would hold. Both optional.", optional: true, empty: (s) => !s.size.trim() && !s.firstEvent.trim(),
            render: (s, set, go) => (
              <div className="cv-pair">
                <CvInput label="Expected members" inputMode="numeric" value={s.size} onChange={(v) => set({ size: v.replace(/\D/g, "").slice(0, 5) })} placeholder="About 25 people" maxLength={5} />
                <CvInput label="First event" autoFocus={false} value={s.firstEvent} onChange={(v) => set({ firstEvent: v })} go={go} placeholder="An open tournament in week 3" maxLength={300} />
              </div>) },
          { id: "contact", ask: "How can the coordinator reach you?", hint: "An email or a phone number.", check: (s) => (s.contact.trim().length < 3 ? "Add a way to reach you." : null),
            render: (s, set, go) => <CvInput label="Contact" value={s.contact} onChange={(v) => set({ contact: v })} go={go} maxLength={120} placeholder="you@university.edu" /> },
        ];

  const summary = circle || reviewer ? undefined : (s: S): [string, string, string][] => [
    ["Name", s.name, "name"], ["Purpose", s.purpose, "purpose"], ["Category", s.category, "category"], ["Adviser", s.advisorName ? `${s.advisorName}, ${s.advisorEmail}` : "", "adviser"],
    ["Meets", s.meeting, "meeting"], ["Expected size", s.size ? `${s.size} people` : "", "more"], ["First event", s.firstEvent, "more"], ["Contact", s.contact, "contact"],
  ];

  async function submit(s: S): Promise<string | null> {
    const kind: OrgKind = circle ? "circle" : reviewer && s.office === "Staff-run office" ? "official" : "student";
    const application: Application = { ...EMPTY_APP, purpose: s.purpose, category: s.category, advisorName: s.advisorName, advisorEmail: s.advisorEmail, meeting: s.meeting, expectedMembers: s.size ? Number(s.size) : null, firstEvent: s.firstEvent, contact: s.contact };
    const description = (s.line || s.purpose).trim().replace(/\s+/g, " ").slice(0, 160);
    const bad = problemWithOrg({ name: s.name, description }, circle || reviewer ? undefined : application);
    if (bad) return bad;
    const r = await orgActions.request({ name: s.name, description, reviewer, kind, application });
    if (r.error) return r.error;
    onSent(r);
    return null;
  }

  return (
    <Converse<S> title={circle ? "Start a student circle" : reviewer ? "Set up a club or office" : "Apply to start a club"} steps={steps} initial={start} summary={summary} submitLabel={circle ? "Start circle" : reviewer ? "Create" : "Send application"}
      note="A coordinator reads this and decides. You will get a notification either way. Tap an answer to change it." onSubmit={submit} onCancel={onCancel} />
  );
}
