import { Component, type ReactNode } from "react";
import ErrorScreen from "./ErrorScreen";

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
      <ErrorScreen label="Oops" title="Something went wrong" message="Orbit hit a problem showing this screen. Reloading usually fixes it." detail={this.state.error.message} onRetry={() => this.setState({ error: null })} />
    );
  }
}
