import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { loadGroupPeople } from "../lib/availability";
import ScheduleSync from "./ScheduleSync";

/** Schedule sync for the members of one group (a chat or a household). Only members who share their free time with you are included, and the rest are named. */
export default function GroupSync({ groupId, title }: { groupId: string; title: string }) {
  const { session } = useAuth();
  const [people, setPeople] = useState<{ id: string; name: string }[] | null>(null);
  useEffect(() => {
    let live = true;
    setPeople(null);
    if (session) void loadGroupPeople(groupId, session.user.id).then((p) => { if (live) setPeople(p); });
    return () => { live = false; };
  }, [groupId, session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!people) return <p className="muted" role="status">Loading the group…</p>;
  return <ScheduleSync groupId={groupId} people={people} title={title} />;
}
