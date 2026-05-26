import { Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/authApi";
import { useAuthStore } from "@/stores/auth";

export function Header() {
  const { accessToken, user, clearAuth } = useAuthStore();
  const router = useRouter();

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Ignore logout API errors — clear state regardless
    }
    clearAuth();
    await router.navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {accessToken ? (
          <Link
            to="/secure/dashboard"
            className="text-lg font-semibold tracking-tight"
          >
            MoneyWise
          </Link>
        ) : (
          <Link to="/" className="text-lg font-semibold tracking-tight">
            MoneyWise
          </Link>
        )}

        <nav className="flex items-center gap-4">
          {accessToken ? (
            <>
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleLogout().catch(() => {
                    toast.error("Something went wrong. Please try again.");
                  });
                }}
              >
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Log in
              </Link>
              <Button asChild size="sm">
                <Link to="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
