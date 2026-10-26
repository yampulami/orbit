import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { friendActions, useFriends } from "../lib/friends";
import { notice } from "../lib/notice";
import { checkUsername, findByUsername, normalizeUsername } from "../lib/username";

/** Add one of your friends to this group, by username or from your list. Friends only: someone you have not befriended is asked to be a friend first. */
export default function GroupAddFriend({ groupId, groupName, memberNames }: { groupId: string; groupName: string; memberNames: string[] }) {
  const { friends } = useFriends();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notFriend, setNotFriend] = useState<{ id: string; name: string } | null>(null);

  const addable = friends.filter((f) => !memberNames.includes(f.name));

  async function add(friendId: string, name: string) {
    setBusy(true);
    const problem = await friendActions.addToGroup(groupId, friendId);
    setBusy(false);
    if (problem) { setError(problem); return false; }
    setError("");
    notice.show({ icon: "pin", title: `${name} is in ${groupName}`, message: "They have been told.", ms: 3500 });
    return true;
  }

  async function byUsername(e: FormEvent) {
    e.preventDefault();
    const bad = checkUsername(q);
    if (bad) { setError(bad); return; }
    setBusy(true);
    const found = await findByUsername(q);
    setBusy(false);
    if (!found) { setError(`Nobody on your campus has the username @${normalizeUsername(q)}.`); return; }
    // Only friends can be added. Someone who is not a friend yet gets a friend request instead, right here.
    if (!friends.some((f) => f.id === found.id)) { setNotFriend(found); setError(""); return; }
    if (await add(found.id, found.name)) setQ("");
  }

  async function befriend() {
    if (!notFriend) return;
    setBusy(true);
    const r = await friendActions.request(notFriend.id);
    setBusy(false);
    if (r.message) { setError(r.message); return; }
    notice.show({ icon: "pin", title: r.becameFriends ? `You and ${notFriend.name} are friends` : "Friend request sent", message: r.becameFriends ? `Now you can add them to ${groupName}.` : `Once ${notFriend.name} accepts, add them here.`, ms: 4500 });
    setNotFriend(null); setQ("");
  }

  return (
    <div className="group-add">
      <form className="friend-search" onSubmit={byUsername}>
        <label className="sr" htmlFor="group-add-q">Add a friend by username</label>
        <span className="onb-at"><span aria-hidden="true">@</span><input id="group-add-q" value={q} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="friend's username" onChange={(e) => { setQ(normalizeUsername(e.target.value).replace(/[^a-z0-9_]/g, "")); setError(""); setNotFriend(null); }} /></span>
        <button className="btn primary" disabled={!q || busy}><UserPlus size={16} aria-hidden="true" />Add</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {notFriend && (
        <p className="muted">
          <strong>{notFriend.name}</strong> is not your friend yet. {" "}
          <button type="button" className="btn" disabled={busy} onClick={() => void befriend()}><UserPlus size={16} aria-hidden="true" />Send friend request</button>
        </p>
      )}
      {addable.length > 0 && (
        <>
          <p className="muted">Or pick from your friends:</p>
          <ul className="friend-list">
            {addable.map((f) => (
              <li key={f.id} className="friend-row">
                <span className="grow"><strong>{f.name}</strong>{f.username && <span className="muted"> @{f.username}</span>}</span>
                <button type="button" className="btn" disabled={busy} onClick={() => void add(f.id, f.name)}>Add</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {friends.length === 0 && <p className="muted">You have no friends on Orbit yet. Find people in the Friends tab, then add them here.</p>}
    </div>
  );
}
