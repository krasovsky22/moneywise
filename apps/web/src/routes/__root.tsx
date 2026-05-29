import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/layout/Header";
import { getMe, refresh } from "@/features/auth/authApi";
import { useAuthStore } from "@/stores/auth";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // Restore session before any child beforeLoad runs (including the /secure guard).
  // useEffect fires after render, so it's always too late for route guards.
  beforeLoad: async () => {
    if (useAuthStore.getState().accessToken) return;
    try {
      const { access_token } = await refresh();
      useAuthStore.setState({ accessToken: access_token });
      const user = await getMe();
      useAuthStore.getState().setAuth(access_token, user);
    } catch {
      useAuthStore.getState().clearAuth();
    }
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <Header />
      <Outlet />
      <Toaster />
    </>
  );
}
