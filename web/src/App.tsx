import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Shell from "./components/Shell";
import Feed from "./pages/Feed";
import { supabase } from "./lib/supabase";
import { feedApi } from "./lib/feedData";
import { loadProfile, pullProfile, saveProfile } from "./lib/profile";
import { profileChanged } from "./lib/nudges";
import { bindHang, hangActions, hangLive, unbindHang } from "./lib/hangouts";
import { notice } from "./lib/notice";
import { bindReminders, unbindReminders } from "./lib/reminders";
import { bindPins, unbindPins } from "./lib/pins";
import { bindPlaces, unbindPlaces } from "./lib/placeVotes";
import { bindRoommates, unbindRoommates } from "./lib/roommates";

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
  const [campusKey, setCampusKey] = useState<string | undefined>();
  useEffect(() => {
    let alive = true;
    setState("checking");
    feedApi.campus()
      .then(async (c) => {
        // On a new device the answers are not here yet: bring them down from the account before the app opens.
        if (c && userId && supabase && !loadProfile(userId)) {
          const p = await pullProfile(userId).catch(() => null);
          if (p) { saveProfile(userId, p); profileChanged(); }
        }
        if (alive) { setCampusKey(c?.key); setState(c ? "yes" : "no"); }
      })
      .catch(() => { if (alive) setState("yes"); });
    return () => { alive = false; };
  }, [userId]);
  return { state, campusKey };
}

/** The app itself: signed in, and onboarded. Anyone who has not picked a university goes to onboarding first. */
function InApp({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const nav = useNavigate();
  const { state: done, campusKey } = useOnboarded(session?.user.id);
  const uid = session?.user.id;
  // With a database, groups and hangouts load for this student once their campus is known, and are forgotten when they leave.
  useEffect(() => {
    if (!hangLive || done !== "yes" || !uid || !campusKey) return;
    const meta = session?.user.user_metadata as { name?: string } | undefined;
    const name = loadProfile(uid)?.name || meta?.name || session?.user.email?.split("@")[0] || "Student";
    bindHang({ id: uid, name, campusKey });
    bindReminders(uid);
    bindPins(uid);
    bindPlaces(uid);
    bindRoommates(uid);
    // An invite link opened before signing in leaves its code here. Use it now that the person is in.
    let waiting: string | null = null;
    try { waiting = sessionStorage.getItem("orbit-join-code"); if (waiting) sessionStorage.removeItem("orbit-join-code"); } catch { /* ignore */ }
    if (waiting) {
      hangActions.joinWithCode(waiting).then((problem) => {
        if (problem) notice.show({ icon: "alert", title: "That invite did not work", message: problem });
        else { notice.show({ icon: "pin", title: "You joined the group", message: "It is on your Groups list.", ms: 4000 }); nav("/app/groups"); }
      });
    }
    return () => { unbindHang(); unbindReminders(); unbindPins(); unbindPlaces(); unbindRoommates(); };
  }, [done, uid, campusKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (done === "checking") return <p className="muted" style={{ padding: 24 }} role="status">Loading…</p>;
  return done === "yes" ? <>{children}</> : <Navigate to="/onboarding" replace />;
}

/** Onboarding is only for people who have not finished it. */
function OnboardingGate() {
  const { session } = useAuth();
  const { state: done } = useOnboarded(session?.user.id);
  if (done === "checking") return <p className="muted" style={{ padding: 24 }} role="status">Loading…</p>;
  return done === "yes" ? <Navigate to="/app" replace /> : <Onboarding />;
}

/** An invite link, /join/CODE. It remembers the code and sends the person on; they join once they are signed in and set up. */
function JoinLink() {
  const { code } = useParams();
  try { if (code) sessionStorage.setItem("orbit-join-code", code.toUpperCase()); } catch { /* ignore */ }
  return <Navigate to="/app/groups" replace />;
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/join/:code" element={<JoinLink />} />
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
