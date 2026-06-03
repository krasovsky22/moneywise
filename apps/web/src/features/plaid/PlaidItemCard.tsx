import { useState } from "react";
import { RefreshCw, Unlink, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlaidItem } from "./plaidApi";
import { useSyncItem } from "./usePlaid";
import { DisconnectDialog } from "./DisconnectDialog";
import { PlaidLinkButton } from "./PlaidLinkButton";

interface PlaidItemCardProps {
  item: PlaidItem;
}

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

const STATUS_CONFIG: Record<
  PlaidItem["status"],
  { label: string; className: string }
> = {
  good: {
    label: "Connected",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  degraded: {
    label: "Degraded",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  login_required: {
    label: "Needs login",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  error: {
    label: "Error",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

function InstitutionLogo({
  name,
  logoUrl,
  color,
}: {
  name: string;
  logoUrl: string | null;
  color: string | null;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="h-9 w-9 rounded-full object-contain"
      />
    );
  }

  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: color ?? "#6366f1" }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

function formatBalance(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export const PlaidItemCard = ({ item }: PlaidItemCardProps) => {
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const sync = useSyncItem();
  const statusConfig = STATUS_CONFIG[item.status];

  const lastSyncedLabel = item.last_synced_at
    ? `Last synced ${relativeTime(item.last_synced_at)}`
    : "Never synced";

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <InstitutionLogo
                name={item.institution_name}
                logoUrl={item.institution_logo_url}
                color={item.institution_color}
              />
              <div className="min-w-0">
                <p className="truncate font-medium leading-tight">
                  {item.institution_name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lastSyncedLabel}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge
                variant="outline"
                className={cn("border-0 text-xs font-medium", statusConfig.className)}
              >
                {statusConfig.label}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => sync.mutate(item.id)}
                disabled={sync.isPending}
                aria-label={`Sync ${item.institution_name}`}
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5",
                    sync.isPending && "animate-spin",
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => setDisconnectOpen(true)}
                aria-label={`Disconnect ${item.institution_name}`}
              >
                <Unlink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {item.status === "login_required" && (
          <div className="mx-4 mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/50 dark:bg-amber-900/20">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="flex-1 text-xs text-amber-700 dark:text-amber-400">
              Your login credentials have changed. Please reconnect to continue
              syncing.
            </p>
            <PlaidLinkButton mode="reconnect" itemId={item.id} />
          </div>
        )}

        {item.accounts.length > 0 && (
          <CardContent className="pt-0">
            <ul className="divide-y">
              {item.accounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {account.nickname}
                      {account.last4 && (
                        <span className="ml-1 text-muted-foreground">
                          ••{account.last4}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {account.subtype ?? account.account_type}
                    </p>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    <p className="text-sm tabular-nums">
                      {formatBalance(account.current_balance)}
                    </p>
                    {account.available_balance !== null &&
                      account.available_balance !== account.current_balance && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatBalance(account.available_balance)} avail.
                        </p>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      <DisconnectDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        itemId={item.id}
        institutionName={item.institution_name}
      />
    </>
  );
};
