import { groupReady, hangActions, hangSnapshot } from "./hangouts";
import { dmActions } from "./dms";

/** Make a group and bring friends into it. With a database a group is private: friends get in with an invite link, so each one is sent a message with it.
 *  Without a database they are simply added. Waits for the group to exist before planning anything in it. Resolves to a message if something went wrong. */
export async function makeGroupAndInvite(opts: {
  name: string;
  friends: { id: string; name: string }[];
  hangout?: { title: string; place: string; when: string };
}): Promise<{ id: string; error?: string; invited: string[] }> {
  const id = hangActions.createGroup(opts.name, opts.friends.map((f) => f.name));
  if (!(await groupReady(id))) return { id, error: "The group did not finish being made. Try again in a moment.", invited: [] };
  if (opts.hangout) hangActions.createHangout(id, opts.hangout);
  const code = hangSnapshot().groups.find((g) => g.id === id)?.code;
  const invited: string[] = [];
  if (code) {
    const link = `${window.location.origin}/join/${code}`;
    const when = opts.hangout ? ` for ${new Date(opts.hangout.when).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "";
    for (const f of opts.friends) {
      const t = await dmActions.start(f.id);
      if (!t) continue;
      dmActions.send(t, `Join "${opts.name}" on Orbit${when}: ${link}`);
      invited.push(f.name);
    }
  }
  return { id, invited };
}
