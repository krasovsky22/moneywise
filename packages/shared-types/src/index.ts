// Shared TypeScript types between frontend and backend.
// TODO: Replace with auto-generated types from FastAPI OpenAPI spec
//   e.g. npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.d.ts

export interface HealthResponse {
  status: string;
  version: string;
}
