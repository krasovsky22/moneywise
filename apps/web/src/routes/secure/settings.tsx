import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/secure/settings")({
  component: SettingsLayout,
});

const TABS = [
  { label: "General", to: "/secure/settings/" },
  { label: "Categories", to: "/secure/settings/categories" },
] as const;

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <nav className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active =
            tab.to === "/secure/settings/"
              ? pathname === "/secure/settings" || pathname === "/secure/settings/"
              : pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.to}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={tab.to as any}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
