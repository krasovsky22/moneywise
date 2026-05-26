import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/secure")({
  beforeLoad: ({ location }) => {
    if (!useAuthStore.getState().accessToken) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: () => <Outlet />,
});
