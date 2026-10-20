import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { DEMO_BUILD } from "./lib/supabase";
import App from "./App";
import "./styles.css";

const Router = DEMO_BUILD ? MemoryRouter : BrowserRouter; // hosted preview can't use real URLs

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </StrictMode>,
);
