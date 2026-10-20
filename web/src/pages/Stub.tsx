export default function Stub({ title, note }: { title: string; note: string }) {
  return (
    <>
      <h1>{title}</h1>
      <div className="card"><p className="muted">{note}</p></div>
    </>
  );
}
