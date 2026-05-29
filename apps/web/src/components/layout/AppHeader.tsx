import { useRef, useState, useEffect } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Search, ChevronDown, Settings, Moon, LogOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { logout } from "@/features/auth/authApi";
import { getHousehold } from "@/features/household/householdApi";

function useDarkMode() {
  const [dark, setDark] = useState(
    () => document.documentElement.classList.contains("dark"),
  );
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }
  return { dark, toggle };
}

function UserAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
      {(name[0] ?? "?").toUpperCase()}
    </div>
  );
}

export function AppHeader() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const router = useRouter();
  const { dark, toggle } = useDarkMode();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: household } = useQuery({
    queryKey: ["household"],
    queryFn: getHousehold,
    enabled: !!accessToken,
    retry: false,
  });

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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

  const displayName = user?.email.split("@")[0] ?? "";
  const householdName = household?.name ?? "My Household";

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-6">
      {/* Search */}
      <div className="relative flex flex-1 items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search for everything..."
          className="h-9 w-full max-w-md rounded-full border border-border bg-background pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Bell */}
        <button className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-primary-subtle">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* User dropdown */}
        {user && (
          <div ref={dropdownRef} className="relative">
            {/* Trigger */}
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2.5 rounded-xl px-2 py-1 transition-colors hover:bg-primary-subtle"
            >
              <UserAvatar name={displayName} />
              <div className="text-left">
                <p className="text-xs leading-tight text-muted-foreground">
                  {householdName}
                </p>
                <p className="text-sm font-semibold leading-tight text-foreground capitalize">
                  {displayName}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  dropdownOpen && "rotate-180",
                )}
              />
            </button>

            {/* Dropdown panel */}
            {dropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-raised">
                {/* Identity header */}
                <div className="border-b border-border px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Family
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">
                    {householdName}
                  </p>
                  <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                    {displayName}
                  </p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <Link
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    to={"/secure/settings" as any}
                    onClick={() => setDropdownOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-primary-subtle hover:text-primary"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>

                  <button
                    onClick={toggle}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-primary-subtle hover:text-primary"
                  >
                    <Moon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">Dark Mode</span>
                    <div
                      className={cn(
                        "relative h-5 w-9 rounded-full transition-colors duration-200",
                        dark ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
                          dark ? "translate-x-4" : "translate-x-0.5",
                        )}
                      />
                    </div>
                  </button>
                </div>

                <div className="border-t border-border py-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      handleLogout().catch(() =>
                        toast.error("Something went wrong. Please try again."),
                      );
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
