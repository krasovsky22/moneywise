import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/secure/statements")({
  component: () => <Outlet />,
});
