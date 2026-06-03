import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { BankAccountIcon } from "./BankAccountIcon";
import { BankAccountForm } from "./BankAccountForm";
import {
  useBankAccounts,
  useCreateBankAccount,
  useUpdateBankAccount,
  useArchiveBankAccount,
  useUnarchiveBankAccount,
} from "./useBankAccounts";
import type { BankAccount, BankAccountCreate } from "./bankAccountsApi";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  money_market: "Money Market",
  other: "Other",
};

type DialogState =
  | { type: "closed" }
  | { type: "create" }
  | { type: "edit"; account: BankAccount }
  | { type: "archive"; account: BankAccount };

export const BankAccountsSettings = () => {
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: "closed" });

  const { data: accounts, isLoading, isError } = useBankAccounts(showArchived);
  const createBankAccount = useCreateBankAccount();
  const updateBankAccount = useUpdateBankAccount();
  const archiveBankAccount = useArchiveBankAccount();
  const unarchiveBankAccount = useUnarchiveBankAccount();

  function handleCreate(data: BankAccountCreate) {
    createBankAccount.mutate(data, {
      onSuccess: () => {
        toast.success("Bank account added.");
        setDialog({ type: "closed" });
      },
      onError: () => {
        toast.error("Failed to add bank account.");
      },
    });
  }

  function handleUpdate(id: string, data: BankAccountCreate) {
    updateBankAccount.mutate(
      { id, data },
      {
        onSuccess: () => {
          toast.success("Bank account updated.");
          setDialog({ type: "closed" });
        },
        onError: () => {
          toast.error("Failed to update bank account.");
        },
      }
    );
  }

  function handleArchive(id: string) {
    archiveBankAccount.mutate(id, {
      onSuccess: () => {
        toast.success("Bank account archived.");
        setDialog({ type: "closed" });
      },
      onError: () => {
        toast.error("Failed to archive bank account.");
      },
    });
  }

  function handleUnarchive(id: string) {
    unarchiveBankAccount.mutate(id, {
      onSuccess: () => {
        toast.success("Bank account restored.");
      },
      onError: () => {
        toast.error("Failed to restore bank account.");
      },
    });
  }

  const visibleAccounts = (accounts ?? []).filter((a) => !a.plaid_account_id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium leading-none">Bank Accounts</p>
        <Button
          size="sm"
          onClick={() => setDialog({ type: "create" })}
          aria-label="Add bank account"
        >
          Add bank account
        </Button>
      </div>

      {/* Show archived toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={showArchived}
          onClick={() => setShowArchived((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <span
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${showArchived ? "bg-primary" : "bg-input"}`}
            aria-hidden="true"
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${showArchived ? "translate-x-3.5" : "translate-x-0.5"}`}
            />
          </span>
          Show archived
        </button>
      </div>

      {/* Account list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load bank accounts.</p>
      ) : visibleAccounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showArchived ? "No bank accounts found." : "No bank accounts yet. Add one to get started."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleAccounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <BankAccountIcon account={account} />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-none">{account.nickname}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span>{account.institution}</span>
                    <span className="mx-1.5">·</span>
                    <span>{ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}</span>
                    {account.last4 && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>••••{account.last4}</span>
                      </>
                    )}
                  </p>
                </div>
                {account.is_archived && (
                  <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                    Archived
                  </Badge>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {account.is_archived ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnarchive(account.id)}
                    disabled={unarchiveBankAccount.isPending}
                    aria-label={`Unarchive ${account.nickname}`}
                  >
                    Unarchive
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDialog({ type: "edit", account })}
                      aria-label={`Edit ${account.nickname}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDialog({ type: "archive", account })}
                      aria-label={`Archive ${account.nickname}`}
                    >
                      Archive
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create dialog */}
      <Dialog
        open={dialog.type === "create"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "closed" });
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add bank account</DialogTitle>
            <DialogDescription>
              Add a bank account to track transactions for your household.
            </DialogDescription>
          </DialogHeader>
          <BankAccountForm
            onSubmit={handleCreate}
            isPending={createBankAccount.isPending}
            submitLabel="Add bank account"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={dialog.type === "edit"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "closed" });
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit bank account</DialogTitle>
            <DialogDescription>Update the details for this bank account.</DialogDescription>
          </DialogHeader>
          {dialog.type === "edit" && (
            <BankAccountForm
              defaultValues={dialog.account}
              onSubmit={(data) => handleUpdate(dialog.account.id, data)}
              isPending={updateBankAccount.isPending}
              submitLabel="Save changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Archive confirmation dialog */}
      <Dialog
        open={dialog.type === "archive"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "closed" });
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive bank account?</DialogTitle>
            <DialogDescription>
              Existing transactions remain. The account stops
              appearing in dashboards.
            </DialogDescription>
          </DialogHeader>
          {dialog.type === "archive" && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDialog({ type: "closed" })}
                disabled={archiveBankAccount.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleArchive(dialog.account.id)}
                disabled={archiveBankAccount.isPending}
                aria-label={`Confirm archive ${dialog.account.nickname}`}
              >
                {archiveBankAccount.isPending ? "Archiving…" : "Archive"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
