/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Tests always run in demo mode, so they never reach a real database and never depend on someone's .env.local.
  test: { env: { VITE_DEMO: "1" } },
  build: {
    rollupOptions: {
      output: {
        // Split big libraries into their own files so a deploy that only changes app code keeps them cached.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
