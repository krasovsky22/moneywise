import ky, { type KyInstance } from "ky";

import { useAuthStore } from "@/stores/auth";

// TODO: Replace with a generated typed client from the FastAPI OpenAPI spec.
// Generation command: npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.d.ts
// Then use openapi-fetch or similar for fully typed calls.

// Track in-flight refresh to avoid concurrent refresh races
let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await ky
        .post("api/v1/auth/refresh", {
          prefixUrl: import.meta.env.VITE_API_URL ?? "/",
          credentials: "include",
        })
        .json<{ access_token: string; token_type: string }>();
      return res.access_token;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function createApiClient(): KyInstance {
  return ky.create({
    // In dev, VITE_API_URL is undefined → requests go to "/" which the Vite proxy
    // forwards to http://localhost:8000. In production, set VITE_API_URL.
    prefixUrl: import.meta.env.VITE_API_URL ?? "/",
    timeout: 10_000,
    credentials: "include",
    hooks: {
      beforeRequest: [
        (request) => {
          const token = useAuthStore.getState().accessToken;
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
        },
      ],
      afterResponse: [
        async (request, _options, response) => {
          if (response.status !== 401) return response;

          // Don't retry if the refresh endpoint itself returned 401 — that would loop
          if (request.url.includes("/auth/refresh")) {
            useAuthStore.getState().clearAuth();
            return response;
          }

          // Attempt a silent refresh
          try {
            const newToken = await doRefresh();

            // Fetch user and update the store
            const { setAuth, clearAuth } = useAuthStore.getState();
            try {
              const user = await ky
                .get("api/v1/users/me", {
                  prefixUrl: import.meta.env.VITE_API_URL ?? "/",
                  credentials: "include",
                  headers: { Authorization: `Bearer ${newToken}` },
                })
                .json<{ id: string; email: string; created_at: string }>();
              setAuth(newToken, user);
            } catch {
              clearAuth();
              if (window.location.pathname !== "/login") {
                window.location.href = "/login";
              }
              return response;
            }

            // Retry the original request with the new token
            return ky(request.url, {
              ...request,
              headers: {
                ...Object.fromEntries(request.headers.entries()),
                Authorization: `Bearer ${newToken}`,
              },
            });
          } catch {
            useAuthStore.getState().clearAuth();
            if (window.location.pathname !== "/login") {
              window.location.href = "/login";
            }
            return response;
          }
        },
      ],
    },
  });
}

export const apiClient = createApiClient();
