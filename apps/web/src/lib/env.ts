import { z } from "zod";

// Typed wrapper around import.meta.env — never access import.meta.env directly
// in app code. Zod validates at startup so misconfigured deployments fail fast.
const envSchema = z.object({
  MODE: z.enum(["development", "production", "test"]),
  // Optional: set in production to point at the deployed API
  VITE_API_URL: z.string().url().optional(),
});

export const env = envSchema.parse({
  MODE: import.meta.env.MODE,
  VITE_API_URL: import.meta.env.VITE_API_URL,
});
