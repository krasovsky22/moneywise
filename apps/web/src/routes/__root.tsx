import { useEffect, useState } from "react";
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
  component: RootComponent,
});

function RootComponent() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const { setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    refresh()
      .then(({ access_token }) =>
        getMe().then((user) => {
          setAuth(access_token, user);
        })
      )
      .catch(() => clearAuth())
      .finally(() => setSessionLoading(false));
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Header />
      <Outlet />
      <Toaster />
    </>
  );
}
