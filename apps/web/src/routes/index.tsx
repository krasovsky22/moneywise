import { createFileRoute } from "@tanstack/react-router";

import { HealthStatus } from "@/features/health/health-status";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">MoneyWise</h1>
        <p className="mt-2 text-muted-foreground">Personal finance, simplified.</p>
      </div>
      <HealthStatus />
      <Button>Get Started</Button>
    </main>
  );
}
