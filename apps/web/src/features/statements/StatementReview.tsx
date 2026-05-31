import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTransactions, useUpdateTransaction, useConfirmStatement } from "@/features/transactions/useTransactions";
import { useCategories, useDeleteRuleByMerchant } from "@/features/categories/useCategories";
import { TransactionRow } from "@/features/transactions/TransactionRow";
import type { TransactionUpdate } from "@/features/transactions/transactionsApi";
import type { Category } from "@/features/categories/categoriesApi";

interface StatementReviewProps {
  statementId: string;
}

function findCategoryName(categories: Category[], id: string): string {
  for (const cat of categories) {
    if (cat.id === id) return cat.name;
    for (const child of cat.children) {
      if (child.id === id) return child.name;
    }
  }
  return id;
}

export const StatementReview = ({ statementId }: StatementReviewProps) => {
  const { data: transactions, isLoading: txLoading } = useTransactions(statementId);
  const { data: categories = [], isLoading: catLoading } = useCategories();
  const updateTransaction = useUpdateTransaction();
  const confirmStatement = useConfirmStatement(statementId);
  const deleteRuleByMerchant = useDeleteRuleByMerchant();

  const handleUpdate = useCallback(
    (id: string, update: TransactionUpdate) => {
      updateTransaction.mutate(
        { id, body: update, createRule: true },
        {
          onSuccess: () => {
            if (update.category_id && transactions) {
              const tx = transactions.find((t) => t.id === id);
              if (tx) {
                const categoryName = findCategoryName(categories, update.category_id!);
                const merchant = tx.merchant_clean;
                toast.success(`Rule saved: ${merchant} → ${categoryName}`, {
                  duration: 4000,
                  action: {
                    label: "Undo",
                    onClick: () => {
                      deleteRuleByMerchant.mutate(merchant);
                    },
                  },
                });
              }
            }
          },
        },
      );
    },
    [updateTransaction, transactions, categories, deleteRuleByMerchant],
  );

  const isLoading = txLoading || catLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading transactions…</span>
      </div>
    );
  }

  const txList = transactions ?? [];
  const lowConfidenceCount = txList.filter((t) => t.is_low_confidence).length;
  const unconfirmedCount = txList.filter((t) => !t.is_user_confirmed).length;

  const merchantCategoryMap = new Map<string, Set<string | null>>();
  for (const tx of txList) {
    const existing = merchantCategoryMap.get(tx.merchant_clean) ?? new Set();
    existing.add(tx.category_id);
    merchantCategoryMap.set(tx.merchant_clean, existing);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            {txList.length} transaction{txList.length !== 1 ? "s" : ""}
            {lowConfidenceCount > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                — {lowConfidenceCount} need{lowConfidenceCount !== 1 ? "" : "s"} review
              </span>
            )}
          </p>
        </div>

        <Button
          size="sm"
          disabled={confirmStatement.isPending || txList.length === 0}
          onClick={() => confirmStatement.mutate()}
          aria-label={`Confirm all transactions in this statement`}
        >
          {confirmStatement.isPending && (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          )}
          Confirm All{unconfirmedCount > 0 ? ` (${unconfirmedCount} remaining)` : ""}
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="grid grid-cols-[100px_1fr_100px_90px_180px_40px] gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>Date</span>
          <span>Merchant</span>
          <span className="text-right">Amount</span>
          <span>Type</span>
          <span>Category</span>
          <span className="text-center">Done</span>
        </div>

        {txList.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No transactions found.
          </div>
        ) : (
          txList.map((tx) => {
            const categorySet = merchantCategoryMap.get(tx.merchant_clean);
            const hasCategoryConflict =
              categorySet !== undefined && categorySet.size > 1;
            return (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                categories={categories}
                onUpdate={handleUpdate}
                hasCategoryConflict={hasCategoryConflict}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
