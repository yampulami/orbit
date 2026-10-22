import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, MessageSquare, Search, UserPlus, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { friendActions, useFriends, useRelation } from "../lib/friends";
import { dmActions } from "../lib/dms";
import { checkUsername, findByUsername, normalizeUsername, type Found } from "../lib/username";

/** Everything about friends in one place: find someone by username, answer requests, see who you have asked, and your friends. */
export default function FriendsPanel() {
  const { session } = useAuth();
  const me = session?.user.id;
  const nav = useNavigate();
  const { friends, incoming, outgoing } = useFriends();
  const [q, setQ] = useState("");
  const [looking, setLooking] = useState(false);
  const [result, setResult] = useState<Found | null | undefined>(undefined); // undefined: not searched yet; null: nobody
  const [error, setError] = useState("");

  async function search(e: FormEvent) {
    e.preventDefault();
    const bad = checkUsername(q);
    if (bad) { setError(bad); setResult(undefined); return; }
    setError(""); setLooking(true);
    setResult(await findByUsername(q));
    setLooking(false);
  }

  const message = async (id: string) => { const t = await dmActions.start(id); if (t) nav("/app/messages", { state: { thread: t } }); };

  return (
    <div className="convo card friends-panel">
      <div className="convo-head"><div><h2>Friends</h2><p className="muted">Add people on your campus, then add them to groups.</p></div></div>

      <form className="friend-search" onSubmit={search}>
        <label className="sr" htmlFor="friend-q">Find a student by username</label>
        <span className="onb-at"><span aria-hidden="true">@</span><input id="friend-q" value={q} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="their username" onChange={(e) => { setQ(normalizeUsername(e.target.value).replace(/[^a-z0-9_]/g, "")); setResult(undefined); setError(""); }} /></span>
        <button className="btn primary" disabled={!q || looking}><Search size={16} aria-hidden="true" />{looking ? "Looking…" : "Find"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {result === null && <p className="muted" role="status">Nobody on your campus has the username @{q}.</p>}
      {result && me && <FoundRow found={result} me={me} />}

      {incoming.length > 0 && (
        <section aria-label="Friend requests">
          <h3>Requests <span className="dm-unread">{incoming.length}</span></h3>
          <ul className="friend-list">
            {incoming.map((r) => (
              <li key={r.id} className="friend-row">
                <Link to={`/app/people/${r.from.id}`} className="person-link grow"><strong>{r.from.name}</strong>{r.from.username && <span className="muted"> @{r.from.username}</span>}</Link>
                <button type="button" className="btn primary" onClick={async () => friendActions.tell(await friendActions.accept(r.id), "Could not accept")}><Check size={16} aria-hidden="true" />Accept</button>
                <button type="button" className="btn" onClick={async () => friendActions.tell(await friendActions.ignore(r.id), "Could not ignore")}><X size={16} aria-hidden="true" />Ignore</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Your friends">
        <h3>Your friends{friends.length > 0 && <span className="muted"> · {friends.length}</span>}</h3>
        {friends.length === 0 ? <p className="rm-empty">No friends yet. Tap someone's name on a post, or find them by username above.</p> : (
          <ul className="friend-list">
            {friends.map((f) => (
              <li key={f.id} className="friend-row">
                <Link to={`/app/people/${f.id}`} className="person-link grow"><strong>{f.name}</strong>{f.username && <span className="muted"> @{f.username}</span>}</Link>
                <button type="button" className="btn" aria-label={`Message ${f.name}`} onClick={() => void message(f.id)}><MessageSquare size={16} aria-hidden="true" />Message</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section aria-label="Requests you sent">
          <h3>Waiting for an answer</h3>
          <ul className="friend-list">
            {outgoing.map((r) => (
              <li key={r.id} className="friend-row">
                <Link to={`/app/people/${r.to.id}`} className="person-link grow"><strong>{r.to.name}</strong>{r.to.username && <span className="muted"> @{r.to.username}</span>}</Link>
                <button type="button" className="btn" onClick={async () => friendActions.tell(await friendActions.cancel(r.to.id), "Could not cancel")}>Cancel request</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** One search result, with the right button for how you stand with them. */
function FoundRow({ found, me }: { found: Found; me: string }) {
  const { relation, requestId } = useRelation(me, found.id);
  return (
    <ul className="friend-list">
      <li className="friend-row">
        <Link to={`/app/people/${found.id}`} className="person-link grow"><strong>{found.name}</strong> <span className="muted">@{found.username}</span></Link>
        {relation === "self" && <span className="muted">That is you</span>}
        {relation === "friends" && <span className="muted"><Check size={14} aria-hidden="true" /> Friends</span>}
        {relation === "outgoing" && <span className="muted">Request sent</span>}
        {relation === "incoming" && requestId && <button type="button" className="btn primary" onClick={async () => friendActions.tell(await friendActions.accept(requestId), "Could not accept")}>Accept request</button>}
        {relation === "none" && <button type="button" className="btn primary" onClick={async () => friendActions.tell((await friendActions.request(found.id)).message, "Could not send the request")}><UserPlus size={16} aria-hidden="true" />Add friend</button>}
      </li>
    </ul>
  );
}
