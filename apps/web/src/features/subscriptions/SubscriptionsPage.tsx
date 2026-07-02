import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Plus, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SubscriptionForm } from "./SubscriptionForm";
import {
  useSubscriptions,
  useConfirmSubscription,
  useDismissSubscription,
  useUpdateSubscription,
  useDeleteSubscription,
  useDetectSubscriptions,
  useSubscriptionCharges,
  useCreateSubscription,
} from "./useSubscriptions";
import type { Subscription, SubscriptionStatus } from "./subscriptionsApi";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const STATUS_BADGE: Record<
  SubscriptionStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending_review: { label: "Needs review", variant: "outline" },
  active: { label: "Active", variant: "default" },
  paused: { label: "Paused", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  dismissed: { label: "Dismissed", variant: "secondary" },
};

function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  if (Number.isNaN(value)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type DialogState =
  | { type: "closed" }
  | { type: "add" }
  | { type: "history"; subscription: Subscription };

const TABS: { value: SubscriptionStatus; label: string }[] = [
  { value: "pending_review", label: "Needs review" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
];

export const SubscriptionsPage = () => {
  const [tab, setTab] = useState<SubscriptionStatus>("pending_review");
  const [dialog, setDialog] = useState<DialogState>({ type: "closed" });

  const { data: subscriptions, isLoading, isError } = useSubscriptions(tab);
  const confirmSubscription = useConfirmSubscription();
  const dismissSubscription = useDismissSubscription();
  const updateSubscription = useUpdateSubscription();
  const deleteSubscription = useDeleteSubscription();
  const detectSubscriptions = useDetectSubscriptions();

  function handleScan() {
    detectSubscriptions.mutate(undefined, {
      onSuccess: (result) => {
        if (result.created > 0) {
          toast.success(
            `Found ${result.created} new subscription${result.created === 1 ? "" : "s"} to review.`,
          );
        } else {
          toast.success("Scan complete — no new subscriptions found.");
        }
      },
      onError: () => toast.error("Failed to scan transactions."),
    });
  }

  function handleConfirm(id: string) {
    confirmSubscription.mutate(id, {
      onSuccess: () => toast.success("Subscription confirmed."),
      onError: () => toast.error("Failed to confirm subscription."),
    });
  }

  function handleDismiss(id: string) {
    dismissSubscription.mutate(id, {
      onSuccess: () => toast.success("Subscription dismissed."),
      onError: () => toast.error("Failed to dismiss subscription."),
    });
  }

  function handleStatusChange(id: string, status: SubscriptionStatus) {
    updateSubscription.mutate(
      { id, data: { status } },
      {
        onSuccess: () =>
          toast.success(status === "cancelled" ? "Marked cancelled." : "Updated."),
        onError: () => toast.error("Failed to update subscription."),
      },
    );
  }

  function handleDelete(id: string) {
    deleteSubscription.mutate(id, {
      onSuccess: () => toast.success("Subscription removed."),
      onError: () => toast.error("Failed to remove subscription."),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">
            Recurring charges detected from your transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleScan}
            disabled={detectSubscriptions.isPending}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-4 w-4 ${detectSubscriptions.isPending ? "animate-spin" : ""}`}
            />
            {detectSubscriptions.isPending ? "Scanning…" : "Scan for subscriptions"}
          </Button>
          <Button onClick={() => setDialog({ type: "add" })} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add subscription
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SubscriptionStatus)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : isError ? (
              <p className="text-sm text-destructive">Failed to load subscriptions.</p>
            ) : !subscriptions || subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t.value === "pending_review"
                  ? "No subscriptions waiting for review. Run a scan to detect recurring charges."
                  : `No ${t.label.toLowerCase()} subscriptions.`}
              </p>
            ) : (
              <ul className="space-y-2">
                {subscriptions.map((sub) => {
                  const badge = STATUS_BADGE[sub.status];
                  return (
                    <li key={sub.id}>
                      <Card>
                        <CardContent className="flex items-center justify-between gap-4 p-4">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setDialog({ type: "history", subscription: sub })}
                          >
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium leading-none">
                                {sub.merchant_clean}
                              </p>
                              <Badge variant={badge.variant} className="shrink-0">
                                {badge.label}
                              </Badge>
                              {sub.source === "manual" && (
                                <Badge variant="outline" className="shrink-0 text-muted-foreground">
                                  Manual
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              <span>{formatMoney(sub.amount_typical, sub.currency)}</span>
                              <span className="mx-1.5">·</span>
                              <span>{FREQUENCY_LABELS[sub.frequency]}</span>
                              <span className="mx-1.5">·</span>
                              <span>Next: {formatDate(sub.next_expected_charge_date)}</span>
                            </p>
                          </button>

                          <div className="flex shrink-0 items-center gap-1">
                            {sub.status === "pending_review" ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-primary hover:text-primary"
                                  onClick={() => handleConfirm(sub.id)}
                                  disabled={confirmSubscription.isPending}
                                  aria-label={`Confirm ${sub.merchant_clean}`}
                                >
                                  <Check className="h-4 w-4" />
                                  Confirm
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-destructive hover:text-destructive"
                                  onClick={() => handleDismiss(sub.id)}
                                  disabled={dismissSubscription.isPending}
                                  aria-label={`Dismiss ${sub.merchant_clean}`}
                                >
                                  <X className="h-4 w-4" />
                                  Dismiss
                                </Button>
                              </>
                            ) : sub.status === "active" ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStatusChange(sub.id, "paused")}
                                  aria-label={`Pause ${sub.merchant_clean}`}
                                >
                                  Pause
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleStatusChange(sub.id, "cancelled")}
                                  aria-label={`Cancel ${sub.merchant_clean}`}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : sub.status === "paused" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusChange(sub.id, "active")}
                                aria-label={`Resume ${sub.merchant_clean}`}
                              >
                                Resume
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(sub.id)}
                                aria-label={`Remove ${sub.merchant_clean}`}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Add subscription dialog */}
      <Dialog
        open={dialog.type === "add"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "closed" });
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add subscription</DialogTitle>
            <DialogDescription>
              Add a subscription that hasn&apos;t been charged yet.
            </DialogDescription>
          </DialogHeader>
          <AddSubscriptionDialogBody onDone={() => setDialog({ type: "closed" })} />
        </DialogContent>
      </Dialog>

      {/* Charge history dialog */}
      <Dialog
        open={dialog.type === "history"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "closed" });
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {dialog.type === "history" && (
            <ChargeHistoryDialogBody subscription={dialog.subscription} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function AddSubscriptionDialogBody({ onDone }: { onDone: () => void }) {
  const createSubscription = useCreateSubscription();
  return (
    <SubscriptionForm
      onSubmit={(data) =>
        createSubscription.mutate(data, {
          onSuccess: () => {
            toast.success("Subscription added.");
            onDone();
          },
          onError: () => toast.error("Failed to add subscription."),
        })
      }
      isPending={createSubscription.isPending}
    />
  );
}

function ChargeHistoryDialogBody({ subscription }: { subscription: Subscription }) {
  const { data: charges, isLoading } = useSubscriptionCharges(subscription.id);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{subscription.merchant_clean}</DialogTitle>
        <DialogDescription>
          {formatMoney(subscription.amount_typical, subscription.currency)} ·{" "}
          {FREQUENCY_LABELS[subscription.frequency]}
          {subscription.notes ? ` — ${subscription.notes}` : ""}
        </DialogDescription>
      </DialogHeader>
      {isLoading ? (
        <div className="h-24 rounded-md bg-muted animate-pulse" />
      ) : !charges || charges.length === 0 ? (
        <p className="text-sm text-muted-foreground">No charge history yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {charges.map((charge) => (
            <li
              key={charge.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>{formatDate(charge.occurred_on)}</span>
              <span className="font-medium">
                {formatMoney(charge.amount, subscription.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
