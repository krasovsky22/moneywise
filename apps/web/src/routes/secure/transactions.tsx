import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/secure/transactions")({
  component: () => <Outlet />,
});
