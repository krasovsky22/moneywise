import { useEffect, useState } from "react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/features/household/householdApi";
import type { Household } from "@/features/household/householdApi";

const searchSchema = z.object({
  token: z.string(),
});

export const Route = createFileRoute("/secure/join-household")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    if (!search.token) {
      throw redirect({ to: "/secure/dashboard" });
    }
  },
  component: JoinHouseholdPage,
});

function JoinHouseholdPage() {
  const { token } = Route.useSearch();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [household, setHousehold] = useState<Household | null>(null);

  useEffect(() => {
    let cancelled = false;

    acceptInvitation(token)
      .then((h) => {
        if (cancelled) return;
        setHousehold(h);
        setStatus("success");
        void queryClient.invalidateQueries({ queryKey: ["household"] });
        void queryClient.invalidateQueries({ queryKey: ["household-members"] });
        void queryClient.invalidateQueries({
          queryKey: ["household-invitations"],
        });
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "loading") {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="text-center space-y-3">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">
            Joining household…
          </p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <h1 className="text-2xl font-bold">Link expired</h1>
          <p className="text-muted-foreground">
            This invite link has expired or is invalid. Ask your household admin
            to send a new one.
          </p>
          <Button
            onClick={() => {
              void router.navigate({ to: "/secure/dashboard" });
            }}
          >
            Go to dashboard
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <h1 className="text-2xl font-bold">
          You've joined {household?.name ?? "the household"}!
        </h1>
        <p className="text-muted-foreground">
          You now have access to shared finances with your household.
        </p>
        <Button
          onClick={() => {
            void router.navigate({ to: "/secure/dashboard" });
          }}
        >
          Go to dashboard
        </Button>
      </div>
    </main>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="mx-auto h-8 w-8 animate-spin text-primary"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
