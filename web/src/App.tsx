import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Shell from "./components/Shell";
import Feed from "./pages/Feed";
import { supabase } from "./lib/supabase";
import { feedApi } from "./lib/feedData";

// Everything except the main feed loads when it is first opened, so the first download stays small.
const Landing = lazy(() => import("./pages/Landing"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Stub = lazy(() => import("./pages/Stub"));
const Plans = lazy(() => import("./pages/Plans"));
const Groups = lazy(() => import("./pages/Groups"));
const Profile = lazy(() => import("./pages/Profile"));
const Messages = lazy(() => import("./pages/Messages"));
const Roommates = lazy(() => import("./pages/Roommates"));
const CampusMap = lazy(() => import("./pages/CampusMap"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <p className="muted" style={{ padding: 24 }} role="status">Loading…</p>;
  return session ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Has this person chosen their university yet? That is what finishing onboarding means, because everything in the app is limited to it. */
function useOnboarded(userId: string | undefined) {
  const [state, setState] = useState<"checking" | "yes" | "no">("checking");
  useEffect(() => {
    let alive = true;
    setState("checking");
    feedApi.campus().then((c) => { if (alive) setState(c ? "yes" : "no"); }).catch(() => { if (alive) setState("yes"); });
    return () => { alive = false; };
  }, [userId]);
  return state;
}

/** The app itself: signed in, and onboarded. Anyone who has not picked a university goes to onboarding first. */
function InApp({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const done = useOnboarded(session?.user.id);
  if (done === "checking") return <p className="muted" style={{ padding: 24 }} role="status">Loading…</p>;
  return done === "yes" ? <>{children}</> : <Navigate to="/onboarding" replace />;
}

/** Onboarding is only for people who have not finished it. */
function OnboardingGate() {
  const { session } = useAuth();
  const done = useOnboarded(session?.user.id);
  if (done === "checking") return <p className="muted" style={{ padding: 24 }} role="status">Loading…</p>;
  return done === "yes" ? <Navigate to="/app" replace /> : <Onboarding />;
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/onboarding" element={<Protected><OnboardingGate /></Protected>} />
        <Route path="/app" element={<Protected><InApp><Shell /></InApp></Protected>}>
          <Route index element={<Navigate to="feed" replace />} />
          <Route path="feed" element={<Feed />} />
          <Route path="messages" element={supabase ? <Stub title="Messages" note="Direct and group chat will live here (tables already exist in your migrations)." /> : <Messages />} />
          <Route path="groups" element={<Groups />} />
          <Route path="roommates" element={<Roommates />} />
          <Route path="plans" element={<Plans />} />
          <Route path="map" element={<CampusMap />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
