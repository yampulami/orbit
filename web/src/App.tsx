import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Shell from "./components/Shell";
import Feed from "./pages/Feed";
import { supabase } from "./lib/supabase";

// Everything except the main feed loads when it is first opened, so the first download stays small.
const Landing = lazy(() => import("./pages/Landing"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Stub = lazy(() => import("./pages/Stub"));
const Plans = lazy(() => import("./pages/Plans"));
const Groups = lazy(() => import("./pages/Groups"));
const Profile = lazy(() => import("./pages/Profile"));
const Messages = lazy(() => import("./pages/Messages"));

function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <p className="muted" style={{ padding: 24 }} role="status">Loading…</p>;
  return session ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/app" element={<Protected><Shell /></Protected>}>
          <Route index element={<Navigate to="feed" replace />} />
          <Route path="feed" element={<Feed />} />
          <Route path="messages" element={supabase ? <Stub title="Messages" note="Direct and group chat will live here (tables already exist in your migrations)." /> : <Messages />} />
          <Route path="groups" element={<Groups />} />
          <Route path="plans" element={<Plans />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
