import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deploys as a GitHub Pages project site: https://lambwright.github.io/helm/
// `base` matches that path so built asset URLs resolve correctly.
//
// Dev proxy keeps the browser origin at http://localhost:5173 the whole time —
// auth-worker's CORS is locked to https://lambwright.github.io, so a direct
// cross-origin call from the dev server would be blocked. Proxying keeps every
// request same-origin from the browser's point of view (TALLY/HANDOFF's pattern).
// HELM has no backend of its own — it only ever talks to auth-worker.
// `--mode localauth` points the proxy at a local auth-worker (wrangler dev on
// :8799) instead of production — for previewing HELM against seeded test data.
export default defineConfig(({ mode }) => ({
  base: "/helm/",
  plugins: [react()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    proxy: {
      "/auth": {
        target: mode === "localauth" ? "http://127.0.0.1:8799" : "https://auth.ben-a90.workers.dev",
        changeOrigin: true,
      },
    },
  },
}));
