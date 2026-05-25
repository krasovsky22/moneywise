import ky from "ky";

// TODO: Replace with a generated typed client from the FastAPI OpenAPI spec.
// Generation command: npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.d.ts
// Then use openapi-fetch or similar for fully typed calls.

export const apiClient = ky.create({
  // In dev, VITE_API_URL is undefined → requests go to "/" which the Vite proxy
  // forwards to http://localhost:8000. In production, set VITE_API_URL.
  prefixUrl: import.meta.env.VITE_API_URL ?? "/",
  timeout: 10_000,
  hooks: {
    beforeRequest: [
      (request) => {
        const token = localStorage.getItem("access_token");
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
  },
});
