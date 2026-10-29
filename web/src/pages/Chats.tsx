import { Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquare, Users } from "lucide-react";
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

  return (
    <div className="chats">
      <div className="chats-switch" role="tablist" aria-label="Chats">
        <button type="button" role="tab" aria-selected={tab === "messages"} onClick={() => go("messages")}>
          <MessageSquare size={16} aria-hidden="true" /> Messages{unread > 0 && <b role="img" aria-label={`${unread} unread`}>{unread > 9 ? "9+" : unread}</b>}
        </button>
        <button type="button" role="tab" aria-selected={tab === "groups"} onClick={() => go("groups")}>
          <Users size={16} aria-hidden="true" /> Groups{waiting > 0 && <b data-warm="" role="img" aria-label={`${waiting} hangouts need your answer`}>{waiting}</b>}
        </button>
      </div>
      <Suspense fallback={<div className="skeleton sk-tile" aria-busy="true" />}>
        {tab === "groups" ? <Groups /> : <Messages />}
      </Suspense>
    </div>
  );
}
