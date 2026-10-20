import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import Shell from "./components/Shell";
import Feed from "./pages/Feed";
import Stub from "./pages/Stub";
import Messages from "./pages/Messages";
import { supabase } from "./lib/supabase";

function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <p className="muted" style={{ padding: 24 }}>Loading…</p>;
  return session ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/app" element={<Protected><Shell /></Protected>}>
        <Route index element={<Navigate to="feed" replace />} />
        <Route path="feed" element={<Feed />} />
        <Route path="messages" element={supabase ? <Stub title="Messages" note="Direct and group chat will live here (tables already exist in your migrations)." /> : <Messages />} />
        <Route path="groups" element={<Stub title="Groups" note="Campus groups and clubs." />} />
        <Route path="plans" element={<Stub title="Plans" note="Chores, expenses, and hangouts for roommates." />} />
        <Route path="profile" element={<Stub title="Profile" note="Your profile and campus settings." />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
