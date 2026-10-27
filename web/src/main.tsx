import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { AuthProvider } from "./lib/auth";
import { DEMO_BUILD } from "./lib/supabase";
import App from "./App";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/fraunces/opsz.css";
import "./styles.css";
import { startHaptics } from "./lib/haptics";

startHaptics();

// A new deploy renames the built files. A tab opened before it can fail to load a screen: reload once to pick up the new build.
window.addEventListener("vite:preloadError", () => {
  try { const last = Number(sessionStorage.getItem("orbit-chunk-reload") ?? 0); if (Date.now() - last < 60_000) return; sessionStorage.setItem("orbit-chunk-reload", String(Date.now())); } catch { /* reload anyway */ }
  location.reload();
});

const Router = DEMO_BUILD ? MemoryRouter : BrowserRouter; // hosted preview can't use real URLs

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </AuthProvider>
    </Router>
  </StrictMode>,
);

// Offline support and installability. Only in a real build, never on the hosted demo preview.
if ("serviceWorker" in navigator && import.meta.env.PROD && !DEMO_BUILD) {
  const register = () => { navigator.serviceWorker.register("/sw.js").catch(() => { /* the app works without it */ }); };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
