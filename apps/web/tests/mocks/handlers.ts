import { http, HttpResponse } from "msw";

export const handlers = [
  // VITE_API_URL is set to "http://localhost" in test env (vite.config.ts)
  // so ky sends to http://localhost/api/v1/health
  http.get("http://localhost/api/v1/health", () =>
    HttpResponse.json({ status: "ok", version: "0.1.0" })
  ),
];
