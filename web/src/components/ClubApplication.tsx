import { CATEGORIES, EMPTY_APP, orgActions, problemWithOrg, type Application, type OrgKind } from "../lib/campusOrgs";
import ClubLook from "./ClubLook";
import Converse, { CvChips, CvInput, CvText, type Step } from "./Converse";
import type { ReactNode } from "react";

/** A field with its name written above it, for steps that ask for more than one thing (a placeholder is not a label). */
const Field = ({ label, children }: { label: string; children: ReactNode }) => <div className="cv-field"><span className="cv-label">{label}</span>{children}</div>;

type S = { name: string; purpose: string; category: string; accent: number | null; advisorName: string; advisorEmail: string; meeting: string; size: string; firstEvent: string; contact: string; office: string; line: string; icon: string };
const start: S = { name: "", purpose: "", category: "", accent: null, advisorName: "", advisorEmail: "", meeting: "", size: "", firstEvent: "", contact: "", office: "", line: "", icon: "" };
const nameStep = (what: string): Step<S> => ({ id: "name", ask: `What should we call ${what}?`, hint: "The name people will see.", check: (s) => (s.name.trim().length < 2 ? "Give it a name, at least 2 letters." : null),
  render: (s, set, go) => <CvInput label="Name" value={s.name} onChange={(v) => set({ name: v })} go={go} maxLength={80} placeholder="Chess Club" /> });

/** Starting a club, an office or a circle, one question at a time. Students apply (a coordinator reads the answers); coordinators set one up directly; a circle just starts. */
export default function ClubApplication({ reviewer, mode = "club", onSent, onCancel }: { reviewer: boolean; mode?: "club" | "circle"; onSent: (r: { id?: string; status?: string }) => void; onCancel: () => void }) {
  const circle = mode === "circle";
  const categoryStep: Step<S> = { id: "category", ask: circle ? "What is it about?" : "Which fits best?", hint: "Pick one so people can find it.", optional: true, empty: (s) => !s.category,
    render: (s, set) => <CvChips label="Category" options={CATEGORIES} value={s.category} onChange={(v) => set({ category: v as string })} /> };

  const iconStep: Step<S> = { id: "icon", ask: "Make it yours", hint: "A colour and an icon, optional. You can change them later.", optional: true, empty: (s) => !s.icon && s.accent === null,
    render: (s, set) => <ClubLook name={s.name} category={s.category} icon={s.icon} accent={s.accent} onIcon={(v) => set({ icon: v })} onAccent={(v) => set({ accent: v })} /> };

  const steps: Step<S>[] = circle
    ? [
        nameStep("your circle"),
        { id: "line", ask: "What is it about, in a line?", hint: "Like a study group or a weekly run. Anyone can join it right away.", optional: true, empty: (s) => !s.line.trim(),
          render: (s, set, go) => <CvInput label="One line" value={s.line} onChange={(v) => set({ line: v })} go={go} maxLength={140} placeholder="Early morning runs around the lake" /> },
        categoryStep,
        iconStep,
      ]
    : reviewer
      ? [
          nameStep("it"),
          { id: "line", ask: "What is it, in a line?", hint: "Shown on its page.", optional: true, empty: (s) => !s.line.trim(),
            render: (s, set, go) => <CvInput label="One line" value={s.line} onChange={(v) => set({ line: v })} go={go} maxLength={160} placeholder="Official events from the Student Life office" /> },
          { id: "office", ask: "Is it a club or a staff-run office?", hint: "A staff-run office posts Official campus events.", check: (s) => (s.office ? null : "Pick one."),
            render: (s, set) => <CvChips label="Kind" options={["Student club", "Staff-run office"]} value={s.office} onChange={(v) => set({ office: v as string })} /> },
          iconStep,
        ]
      : [
          nameStep("your club"),
          { id: "purpose", ask: "What is it for, and who is it for?", hint: "A couple of sentences for the coordinator who decides.", check: (s) => (s.purpose.trim().length < 30 ? "Tell the coordinator a little more, a couple of sentences." : null),
            render: (s, set, go) => <CvText label="Purpose" value={s.purpose} onChange={(v) => set({ purpose: v })} go={go} maxLength={600} placeholder="We play casual games, run beginner lessons and hold a spring tournament. Everyone is welcome." /> },
          categoryStep,
          iconStep,
          { id: "people", ask: "Who is behind it?", hint: "Every club needs a faculty or staff adviser. Add how the coordinator can reach you too.",
            check: (s) => (s.advisorName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(s.advisorEmail.trim()) ? "Add the adviser's name and a valid email." : s.contact.trim().length < 3 ? "Add a way to reach you." : null),
            render: (s, set) => (
              <div className="cv-pair">
                <Field label="Adviser name"><CvInput label="Adviser name" value={s.advisorName} onChange={(v) => set({ advisorName: v })} placeholder="Dr. Rivera" maxLength={80} /></Field>
                <Field label="Adviser email"><CvInput label="Adviser email" type="email" inputMode="email" autoFocus={false} value={s.advisorEmail} onChange={(v) => set({ advisorEmail: v })} placeholder="rivera@university.edu" maxLength={120} /></Field>
                <Field label="Your email or phone"><CvInput label="Contact" autoFocus={false} value={s.contact} onChange={(v) => set({ contact: v })} placeholder="you@university.edu" maxLength={120} /></Field>
              </div>) },
          { id: "meeting", ask: "When and where will you meet?", hint: "It can change later. The last two are optional.", check: (s) => (s.meeting.trim().length < 3 ? "Say where and when the club meets." : null),
            render: (s, set, go) => (
              <div className="cv-pair">
                <Field label="Meeting time and place"><CvInput label="Meeting time and place" value={s.meeting} onChange={(v) => set({ meeting: v })} maxLength={160} placeholder="Thursdays at 6 PM, Student Center room 204" /></Field>
                <Field label="Expected members"><CvInput label="Expected members" autoFocus={false} inputMode="numeric" value={s.size} onChange={(v) => set({ size: v.replace(/\D/g, "").slice(0, 5) })} placeholder="About 25 people" maxLength={5} /></Field>
                <Field label="A first event you would hold"><CvInput label="First event" autoFocus={false} value={s.firstEvent} onChange={(v) => set({ firstEvent: v })} go={go} placeholder="An open tournament in week 3" maxLength={300} /></Field>
              </div>) },
        ];

  const summary = circle || reviewer ? undefined : (s: S): [string, string, string][] => [
    ["Name", s.name, "name"], ["Purpose", s.purpose, "purpose"], ["Category", s.category, "category"], ["Look", s.icon || s.accent !== null ? "Chosen" : "", "icon"], ["Adviser", s.advisorName ? `${s.advisorName}, ${s.advisorEmail}` : "", "people"],
    ["Meets", s.meeting, "meeting"], ["Expected size", s.size ? `${s.size} people` : "", "meeting"], ["First event", s.firstEvent, "meeting"], ["Contact", s.contact, "people"],
  ];

  async function submit(s: S): Promise<string | null> {
    const kind: OrgKind = circle ? "circle" : reviewer && s.office === "Staff-run office" ? "official" : "student";
    const application: Application = { ...EMPTY_APP, purpose: s.purpose, category: s.category, advisorName: s.advisorName, advisorEmail: s.advisorEmail, meeting: s.meeting, expectedMembers: s.size ? Number(s.size) : null, firstEvent: s.firstEvent, contact: s.contact };
    const description = (s.line || s.purpose).trim().replace(/\s+/g, " ").slice(0, 160);
    const bad = problemWithOrg({ name: s.name, description }, circle || reviewer ? undefined : application);
    if (bad) return bad;
    const r = await orgActions.request({ name: s.name, description, reviewer, kind, application });
    if (r.error) return r.error;
    if ((s.icon || s.accent !== null) && r.id) await orgActions.updateLook(r.id, { accent: s.accent, icon: s.icon });
    onSent(r);
    return null;
  }

  return (
    <Converse<S> title={circle ? "Start a student circle" : reviewer ? "Set up a club or office" : "Apply to start a club"} steps={steps} initial={start} summary={summary} submitLabel={circle ? "Start circle" : reviewer ? "Create" : "Send application"}
      note="A coordinator reads this and decides. You will get a notification either way. Tap an answer to change it." onSubmit={submit} onCancel={onCancel} />
  );
}
