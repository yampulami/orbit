import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, MessageSquare } from "lucide-react";
import AlumniAsk from "./AlumniAsk";
import { dmActions } from "../lib/dms";
import { notice } from "../lib/notice";
import type { Alum, Req } from "../lib/alumni";
import { introState } from "../lib/introState";

/** Opens the conversation with the other person (accepting a request made it a normal chat). */
export function MessageButton({ id, name }: { id: string; name: string }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    const thread = await dmActions.start(id);
    setBusy(false);
    if (thread) nav("/app/messages", { state: { thread } });
    else notice.show({ icon: "wifi", title: "Could not open the chat", message: "Check your connection and try again." });
  };
  return <button type="button" className="btn sm primary" disabled={busy} onClick={() => void open()} aria-label={`Message ${name}`}><MessageSquare size={14} aria-hidden="true" /> {busy ? "Opening…" : "Message"}</button>;
}

type Props = {
  person: Alum;
  reqs: Req[];
  shared: string[];
  ask: (id: string, note: string) => Promise<string | null>;
  seeRequests: () => void;
  /** The strong button: used where this is the one thing to do. */
  warm?: boolean;
};

/** The one thing a student can do about a graduate, wherever the graduate is shown: ask, see the request, wait, or message. */
export default function AlumniAction({ person, reqs, shared, ask, seeRequests, warm = false }: Props) {
  const [asking, setAsking] = useState(false);
  const state = introState(reqs, person.id);
  if (state === "accepted") return <MessageButton id={person.id} name={person.name} />;
  if (state === "pending") return <button type="button" className="btn sm" onClick={seeRequests}><Check size={14} aria-hidden="true" /> Requested · view</button>;
  if (state === "wait") return <p className="alc-later">You asked recently. You can ask again later.</p>;
  return (
    <>
      <button type="button" className={"btn sm alc-ask" + (warm ? " primary" : "")} onClick={() => setAsking(true)} aria-label={`Ask ${person.name} for an introduction`}>Ask for an introduction</button>
      {asking && <AlumniAsk person={person} shared={shared} onClose={() => setAsking(false)}
        onSend={async (note) => {
          const p = await ask(person.id, note);
          if (!p) { notice.show({ icon: "calendar", title: `Sent to ${person.name}`, message: "You will get a notification if they accept. You can take it back from Requests until then.", ms: 7000 }); setAsking(false); }
          return p;
        }} />}
    </>
  );
}
