import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Megaphone, Newspaper, Pencil, Repeat2, Settings, type LucideIcon } from "lucide-react";
import { feedApi, type Row } from "../lib/feedData";
import { useCampusOrgs } from "../lib/campusOrgs";
import { useCampusEvents } from "../lib/campusEvents";
import { dayLabel, hueFor } from "../lib/look";
import EventCard from "./EventCard";
import EmptyState from "./EmptyState";
import RichText from "./RichText";
import VerifiedBadge from "./VerifiedBadge";
import type { GMItem } from "./GradientMenu";

export type ProfileTab = "posts" | "reposts" | "clubs" | "edit" | "settings";

/** The tabs on a profile. Your own has two more, for editing and settings. */
export function profileTabs(isMe: boolean, counts: { posts: number; reposts: number }, set: (t: ProfileTab) => void, tab: ProfileTab): GMItem[] {
  const base: { id: ProfileTab; label: string; icon: LucideIcon; tone: GMItem["tone"]; badge?: string }[] = [
    { id: "posts", label: "Posts", icon: Newspaper, tone: "purple", badge: counts.posts > 0 ? String(counts.posts) : undefined },
    { id: "reposts", label: "Reposts", icon: Repeat2, tone: "green", badge: counts.reposts > 0 ? String(counts.reposts) : undefined },
    { id: "clubs", label: "Clubs and events", icon: Megaphone, tone: "orange" },
  ];
  if (isMe) base.push({ id: "edit", label: "Edit profile", icon: Pencil, tone: "pink" }, { id: "settings", label: "Settings", icon: Settings, tone: "blue" });
  return base.map((b) => ({ key: b.id, label: b.label, icon: b.icon, tone: b.tone, on: tab === b.id, onClick: () => set(b.id) }));
}

/** What a person has posted, reposted and joined. Used under the header of your profile and of anyone else's. */
export function useProfileRows(userId: string) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = () => { feedApi.list().then(setRows).catch(() => setRows([])); };
  useEffect(() => { load(); const again = () => load(); window.addEventListener("orbit-posts-changed", again); return () => window.removeEventListener("orbit-posts-changed", again); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = (rows ?? []).filter((r) => r.author_id === userId);
  return { loaded: rows !== null, posts: mine.filter((r) => !r.payload.repostOf), reposts: mine.filter((r) => !!r.payload.repostOf), reload: load };
}

function PostRow({ r, isMe, onUndo }: { r: Row; isMe: boolean; onUndo?: () => void }) {
  const when = dayLabel(r.created_at, new Date());
  return (
    <li className="pa-post">
      <div className="pa-meta"><span className="chip">{r.community}</span><span className="muted">{when}</span></div>
      {r.payload.repostOf && <p className="repost-note"><Repeat2 size={14} aria-hidden="true" /> Reposted from {r.payload.repostName ?? "someone"}</p>}
      <p className="pa-body"><RichText text={r.payload.body ?? r.payload.text ?? ""} /></p>
      <div className="pa-foot">
        <span className="pa-count"><Heart size={15} aria-hidden="true" /> {r.post_likes.length}</span>
        <span className="pa-count"><MessageCircle size={15} aria-hidden="true" /> {r.post_comments.length}</span>
        <Link className="link-btn" to={`/app/feed?post=${r.payload.repostOf ?? r.id}`}>Open in feed</Link>
        {isMe && onUndo && <button type="button" className="link-btn" onClick={onUndo}>Undo repost</button>}
      </div>
    </li>
  );
}

export default function ProfileActivity({ tab, userId, isMe, name, data }: { tab: "posts" | "reposts" | "clubs"; userId: string; isMe: boolean; name: string; data: ReturnType<typeof useProfileRows> }) {
  const { orgs } = useCampusOrgs();
  const { events } = useCampusEvents();
  const now = new Date();
  const first = name.split(" ")[0] || name;

  if (tab === "posts") {
    return data.loaded && data.posts.length === 0
      ? <EmptyState icon={Newspaper} title="No posts yet">{isMe ? "What you post in the feed shows up here." : `${first} has not posted yet.`}</EmptyState>
      : <ul className="pa-list">{data.posts.map((r) => <PostRow key={r.id} r={r} isMe={isMe} />)}</ul>;
  }
  if (tab === "reposts") {
    return data.loaded && data.reposts.length === 0
      ? <EmptyState icon={Repeat2} title="No reposts yet">{isMe ? "Posts you repost from the feed are kept here." : `${first} has not reposted anything.`}</EmptyState>
      : <ul className="pa-list">{data.reposts.map((r) => <PostRow key={r.id} r={r} isMe={isMe} onUndo={() => { void Promise.resolve(feedApi.remove(r.id)).then(() => data.reload()); }} />)}</ul>;
  }

  const clubs = orgs.filter((o) => o.status === "active" && (isMe ? o.mine || o.myJoin === "member" : o.members.some((m) => m.id === userId) || o.clubMembers.some((m) => m.id === userId)));
  const going = isMe ? events.filter((e) => e.status === "published" && !e.canceled && (e.mine === "going" || e.mineHost) && new Date(e.endsAt ?? e.startsAt).getTime() > now.getTime()).sort((a, b) => a.startsAt.localeCompare(b.startsAt)) : [];
  if (clubs.length === 0 && going.length === 0) return <EmptyState icon={Megaphone} title="No clubs or events yet">{isMe ? "Clubs you join and events you are going to show up here." : `${first} has not joined any clubs yet.`}</EmptyState>;
  return (
    <div className="pa-clubs">
      {clubs.length > 0 && (
        <section>
          <h3 className="pa-h">Clubs</h3>
          <ul className="club-rows">
            {clubs.map((o) => (
              <li key={o.id}>
                <Link className="club-row" style={{ ["--h" as string]: o.accent ?? hueFor(o.name) }} to={`/app/campus/clubs/${o.id}`}>
                  <span className="club-mark" aria-hidden="true">{o.icon || o.name.slice(0, 1).toUpperCase()}</span>
                  <span className="club-text"><strong>{o.name}{o.kind !== "circle" && <VerifiedBadge label="Verified" />}</strong><span className="club-sub">{o.description || (o.kind === "circle" ? "Student circle" : "Student club")}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {going.length > 0 && (
        <section>
          <h3 className="pa-h">Events coming up</h3>
          <ul className="ev-list">{going.map((e) => <EventCard key={e.id} e={e} reviewer={false} />)}</ul>
        </section>
      )}
    </div>
  );
}
