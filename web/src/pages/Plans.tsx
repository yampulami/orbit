import { useEffect, useState } from "react";
import Calendar from "../components/Calendar";
import { feedApi as api, type Row } from "../lib/feedData";

export default function Plans() {
  const [posts, setPosts] = useState<Row[]>([]);
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => { api.list().then(setPosts).catch(() => setPosts([])); }, []);
  const onDay = day ? posts.filter((p) => new Date(p.created_at).toDateString() === day) : [];

  return (
    <div className="page">
      <h1 className="sr">Plans</h1>
      <div className={"plans" + (day ? " open" : "")}>
        <Calendar posts={posts} day={day} onDay={setDay} />
        {day && <section className="people" aria-label="Posts on the selected day">
          <header><h3>{day && new Date(day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3></header>
          {day && onDay.length === 0 && <p className="muted" style={{ fontSize: ".9rem" }}>No posts on this day.</p>}
          <ul>
            {onDay.map((p) => (
              <li key={p.id} style={{ gridTemplateColumns: "1fr" }}>
                <div><strong>{p.author_name} · {p.community}</strong><span style={{ fontSize: ".9rem", color: "var(--ink)" }}>{p.payload.body ?? p.payload.text ?? ""}</span></div>
              </li>
            ))}
          </ul>
        </section>}
      </div>
    </div>
  );
}
