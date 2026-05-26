import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // TanStackRouterVite MUST come before react() — it generates routeTree.gen.ts
    // which the React plugin then processes
    TanStackRouterVite({ routesDirectory: "./src/routes" }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Forward /api/* to FastAPI — no rewrite needed since FastAPI routes
      // already include the /api/v1 prefix
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  // Vitest configuration co-located here
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    // Set VITE_API_URL so ky uses an absolute URL in tests.
    // Node's native fetch requires absolute URLs; relative prefixUrl "/" won't work.
    env: {
      VITE_API_URL: "http://localhost",
    },
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**"],
      exclude: ["src/routeTree.gen.ts"],
    },
  },
});
