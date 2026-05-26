import { createFileRoute } from "@tanstack/react-router";

import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/secure/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Welcome, {user?.email}</h1>
    </main>
  );
}
