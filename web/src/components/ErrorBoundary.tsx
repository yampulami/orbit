import { Component, type ReactNode } from "react";

/** Without this, one crash in any screen blanks the whole app. This shows what went wrong and a way to recover. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) {
    console.error("Orbit crashed:", error);
    // After a new version goes live, an open tab can ask for a screen file that no longer exists. Load the new version, at most once a minute.
    if (/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(error.message)) {
      try { const last = Number(sessionStorage.getItem("orbit-chunk-reload") ?? 0); if (Date.now() - last < 60_000) return; sessionStorage.setItem("orbit-chunk-reload", String(Date.now())); } catch { /* reload anyway */ }
      location.reload();
    }
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page" role="alert" style={{ display: "grid", gap: 12, alignContent: "center", minHeight: "60vh", textAlign: "center", justifyItems: "center" }}>
        <h1 style={{ fontSize: "1.4rem" }}>Something went wrong</h1>
        <p className="muted">Orbit hit a problem showing this screen. Reloading usually fixes it.</p>
        <p className="muted" style={{ fontSize: ".8rem", maxWidth: 520, overflowWrap: "anywhere" }}>{this.state.error.message}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn primary" onClick={() => location.reload()}>Reload</button>
          <button type="button" className="btn" onClick={() => { this.setState({ error: null }); }}>Try again</button>
        </div>
      </div>
    );
  }
}
