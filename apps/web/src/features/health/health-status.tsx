import { useQuery } from "@tanstack/react-query";

import type { HealthResponse } from "@moneywise/shared-types";

import { apiClient } from "@/lib/api-client";

export function HealthStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient.get("api/v1/health").json<HealthResponse>(),
  });

  if (isLoading) return <p className="text-muted-foreground">Checking API...</p>;
  if (isError) return <p className="text-destructive">API unreachable</p>;
  if (data) {
    return (
      <p className="text-green-600">
        API status: <strong>{data.status}</strong> (v{data.version})
      </p>
    );
  }
  return null;
}
