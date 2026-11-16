import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import Avatar from "./Avatar";
import { friendActions, useFriends } from "../lib/friends";
import { notice } from "../lib/notice";
import { checkUsername, findByUsername, normalizeUsername } from "../lib/username";

/** Add people to this group. Two plain things: your friends who are not in it yet (one tap each), or someone by username. Friends only: someone you
 *  have not befriended is asked to be a friend first. Who is already in the group is shown in the header, not here. */
export default function GroupAddFriend({ groupId, groupName, memberNames }: { groupId: string; groupName: string; memberNames: string[] }) {
  const { friends } = useFriends();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // the friend being added, or "search"
  const [error, setError] = useState("");
  const [notFriend, setNotFriend] = useState<{ id: string; name: string } | null>(null);

  const addable = friends.filter((f) => !memberNames.includes(f.name));

  async function add(friendId: string, name: string) {
    setBusy(friendId);
    const problem = await friendActions.addToGroup(groupId, friendId);
    setBusy(null);
    if (problem) { setError(problem); return false; }
    setError("");
    notice.show({ icon: "pin", title: `${name} is in ${groupName}`, message: "They have been told.", ms: 3500 });
    return true;
  }

  async function byUsername(e: FormEvent) {
    e.preventDefault();
    const bad = checkUsername(q);
    if (bad) { setError(bad); return; }
    setBusy("search");
    const found = await findByUsername(q);
    setBusy(null);
    if (!found) { setError(`Nobody on your campus has the username @${normalizeUsername(q)}.`); return; }
    if (memberNames.includes(found.name)) { setError(`${found.name} is already in ${groupName}.`); return; }
    // Only friends can be added. Someone who is not a friend yet gets a friend request instead, right here.
    if (!friends.some((f) => f.id === found.id)) { setNotFriend(found); setError(""); return; }
    if (await add(found.id, found.name)) setQ("");
  }

  async function befriend() {
    if (!notFriend) return;
    setBusy("search");
    const r = await friendActions.request(notFriend.id);
    setBusy(null);
    if (r.message) { setError(r.message); return; }
    notice.show({ icon: "pin", title: r.becameFriends ? `You and ${notFriend.name} are friends` : "Friend request sent", message: r.becameFriends ? `Now you can add them to ${groupName}.` : `Once ${notFriend.name} accepts, add them here.`, ms: 4500 });
    setNotFriend(null); setQ("");
  }

  return (
    <div className="group-add">
      <section aria-labelledby="ga-friends">
        <h4 id="ga-friends" className="ga-h">Your friends</h4>
        {addable.length > 0 ? (
          <ul className="ga-list">
            {addable.map((f) => (
              <li key={f.id}>
                <Avatar name={f.name} id={f.id} size={34} />
                <span className="ga-name">{f.name}</span>
                <button type="button" className="btn" disabled={busy !== null} onClick={() => void add(f.id, f.name)}><UserPlus size={16} aria-hidden="true" />{busy === f.id ? "Adding…" : "Add"}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{friends.length === 0 ? "You have no friends on Orbit yet. Find people in the Friends tab, or add someone by username below." : `All your friends are already in ${groupName}.`}</p>
        )}
      </section>
      <section aria-labelledby="ga-user">
        <h4 id="ga-user" className="ga-h">Someone else? Use their username</h4>
        <form className="friend-search" onSubmit={byUsername}>
          <label className="sr" htmlFor="group-add-q">Username</label>
          <span className="onb-at"><span aria-hidden="true">@</span><input id="group-add-q" value={q} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="username" onChange={(e) => { setQ(normalizeUsername(e.target.value).replace(/[^a-z0-9_]/g, "")); setError(""); setNotFriend(null); }} /></span>
          <button className="btn primary" disabled={!q || busy !== null}>{busy === "search" ? "Looking…" : "Add"}</button>
        </form>
        {notFriend && (
          <p className="muted">
            <strong>{notFriend.name}</strong> is not your friend yet, so send a friend request first. {" "}
            <button type="button" className="btn" disabled={busy !== null} onClick={() => void befriend()}><UserPlus size={16} aria-hidden="true" />Send friend request</button>
          </p>
        )}
      </section>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
