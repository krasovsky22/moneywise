import { useState } from "react";
import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Repeat,
  Bitcoin,
  MessageSquare,
  BarChart2,
  Settings,
  UserCheck,
  HelpCircle,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { logout } from "@/features/auth/authApi";

type LucideIcon = React.ComponentType<{ className?: string }>;

type NavLeaf = { icon: LucideIcon; label: string; to?: string; badge?: number };
type NavGroup = NavLeaf & { children: NavLeaf[] };
type NavItem = NavLeaf | NavGroup;

const MENU_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Overview", to: "/secure/dashboard" },
  { icon: Wallet, label: "My Wallet", to: "/secure/wallet" },
  { icon: ArrowLeftRight, label: "Transactions", to: "/secure/transactions" },
  { icon: Repeat, label: "Subscriptions", to: "/secure/subscriptions" },
  { icon: Bitcoin, label: "Cryptocurrency" },
  { icon: MessageSquare, label: "Messages", badge: 2 },
  { icon: BarChart2, label: "Report" },
];

const SETTINGS_ITEMS: NavItem[] = [
  { icon: Settings, label: "Setting", to: "/secure/settings" },
  { icon: UserCheck, label: "Feedback" },
  { icon: HelpCircle, label: "Help & Center" },
];

function NavRow({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = !!item.to && pathname === item.to;
  const hasChildren = "children" in item;
  const Icon = item.icon;

  const rowClass = cn(
    "flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
    depth > 0 && "pl-10",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-foreground hover:bg-primary-subtle hover:text-primary",
  );

  const inner = (
    <>
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge != null && (
        <span
          className={cn(
            "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
            isActive
              ? "bg-white/20 text-primary-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          {item.badge}
        </span>
      )}
      {hasChildren && (
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      )}
    </>
  );

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(rowClass, "w-full cursor-pointer")}
        >
          {inner}
        </button>
        {open && (
          <div className="mt-0.5 space-y-0.5">
            {(item as NavGroup).children.map((child) => (
              <NavRow key={child.label} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (item.to) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Link to={item.to as any} className={rowClass}>
        {inner}
      </Link>
    );
  }

  return (
    <div
      className={cn(rowClass, "cursor-not-allowed opacity-40")}
      title="Coming soon"
    >
      {inner}
    </div>
  );
}

export function Sidebar() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const router = useRouter();

  async function handleLogout() {
    try {
      await logout();
    } catch {
      /* clear state regardless */
    }
    clearAuth();
    await router.navigate({ to: "/" });
    toast.success("Logged out");
  }

  return (
    <aside className="flex h-screen w-[280px] shrink-0 flex-col border-r border-border bg-card px-4 py-6">
      {/* Logo — links to dashboard */}
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to={"/secure/dashboard" as any}
        className="mb-8 flex items-center gap-3 px-1 transition-opacity hover:opacity-80"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-primary-foreground">M</span>
        </div>
        <span className="text-base font-semibold tracking-tight text-foreground">
          Moneywise
        </span>
      </Link>

      {/* Nav sections */}
      <nav className="flex-1 space-y-6 overflow-y-auto">
        <div className="space-y-0.5">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Menu
          </p>
          {MENU_ITEMS.map((item) => (
            <NavRow key={item.label} item={item} />
          ))}
        </div>

        <div className="space-y-0.5">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Help &amp; Setting
          </p>
          {SETTINGS_ITEMS.map((item) => (
            <NavRow key={item.label} item={item} />
          ))}
        </div>
      </nav>

      {/* Logout */}
      <div className="mt-4 border-t border-border pt-4">
        <button
          onClick={() => {
            handleLogout().catch(() =>
              toast.error("Something went wrong. Please try again."),
            );
          }}
          className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
