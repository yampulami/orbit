import { Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";
import { unreadDms, useDms } from "../lib/dms";
import { isVisible, useHang, YOU } from "../lib/hangouts";

// Each side loads only when it is opened.
const Messages = lazy(() => import("./Messages"));
const Groups = lazy(() => import("./Groups"));

/** One place for talking to people: direct messages on one side, groups and their hangouts on the other. */
export default function Chats() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "groups" ? "groups" : "messages";
  const unread = unreadDms(useDms().threads);
  const { groups, hangouts } = useHang();
  const waiting = hangouts.filter((h) => isVisible(h, groups) && !h.rsvps[YOU] && new Date(h.when).getTime() > Date.now()).length;
  const go = (t: "messages" | "groups") => setParams(t === "groups" ? { tab: "groups" } : {}, { replace: true, state: undefined });

  // One sentence that says where things stand, like the top of the Feed.
  const head = tab === "groups"
    ? waiting > 0 ? `${waiting} plan${waiting === 1 ? "" : "s"} from your groups need${waiting === 1 ? "s" : ""} an answer` : "Your groups"
    : unread > 0 ? `${unread} new message${unread === 1 ? "" : "s"}` : "You are all caught up";

  return (
    <div className="chats">
      <h2 className="chats-head">{head}</h2>
      <div className="chats-switch" role="tablist" aria-label="Chats">
        <button type="button" role="tab" aria-selected={tab === "messages"} onClick={() => go("messages")}>
          Messages{unread > 0 && <b role="img" aria-label={`${unread} unread`}>{unread > 9 ? "9+" : unread}</b>}
        </button>
        <button type="button" role="tab" aria-selected={tab === "groups"} onClick={() => go("groups")}>
          Groups{waiting > 0 && <b data-warm="" role="img" aria-label={`${waiting} hangouts need your answer`}>{waiting}</b>}
        </button>
      </div>
      <Suspense fallback={<div className="skeleton sk-tile" aria-busy="true" />}>
        {tab === "groups" ? <Groups /> : <Messages />}
      </Suspense>
    </div>
  );
}
