import { Link, useSearchParams } from "react-router-dom";

/** Where the Unsubscribe link in a notification email lands. The function has already turned the emails off by the time you see this. */
export default function EmailOff() {
  const [params] = useSearchParams();
  const problem = params.get("problem") === "1";
  return (
    <main className="auth">
      <div className="card">
        <Link to="/" className="logo"><i />Orbit</Link>
        <h1 style={{ fontSize: "1.6rem" }}>{problem ? "That link did not work" : "You are unsubscribed"}</h1>
        <p className="muted">{problem
          ? "It may be old or cut short. Sign in and turn the emails off in Profile, under Notifications."
          : "Orbit will not email you about what you missed. You can turn them back on any time in Profile, under Notifications."}</p>
        <Link to="/app/profile" className="btn">Open Profile</Link>
      </div>
    </main>
  );
}
