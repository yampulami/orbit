export default function Stub({ title, note }: { title: string; note: string }) {
  return (
    <div className="page">
      <h1 className="sr">{title}</h1>
      <div className="card" style={{ background: "var(--panel)", border: 0, boxShadow: "none" }}><p className="muted">{note}</p></div>
    </div>
  );
}
