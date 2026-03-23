import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite Configuration
 * ------------------
 * Vite is the build tool and dev server for the frontend.
 * It's much faster than Webpack for development because it uses
 * native ES modules in the browser instead of bundling everything upfront.
 *
 * Key config here:
 *   - React plugin: enables JSX transform and React Fast Refresh (hot reload)
 *   - server.proxy: during local development, forward /api requests to the
 *     Python backend so we don't run into CORS issues while developing
 */
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      // Any request to /api/* gets forwarded to the local FastAPI server.
      // This means in development you can call fetch("/api/v1/parse")
      // and Vite will proxy it to http://localhost:8000/api/v1/parse.
      // In production (AWS), the real API Gateway URL is used instead.
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
