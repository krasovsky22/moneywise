import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

import { useAuthStore } from "@/stores/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";

export const Route = createFileRoute("/secure")({
  beforeLoad: ({ location }) => {
    if (!useAuthStore.getState().accessToken) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: SecureLayout,
});

function SecureLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
