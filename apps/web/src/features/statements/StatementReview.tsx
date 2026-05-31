import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTransactions, useUpdateTransaction, useConfirmStatement } from "@/features/transactions/useTransactions";
import { useCategories, useCreateRule } from "@/features/categories/useCategories";
import { TransactionRow } from "@/features/transactions/TransactionRow";
import type { TransactionUpdate } from "@/features/transactions/transactionsApi";

interface RuleSuggestion {
  merchantClean: string;
  categoryId: string;
  categoryName: string;
}

interface StatementReviewProps {
  statementId: string;
}

function findCategoryName(
  categories: import("@/features/categories/categoriesApi").Category[],
  id: string
): string {
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
  const createRule = useCreateRule();

  const [ruleSuggestion, setRuleSuggestion] = useState<RuleSuggestion | null>(null);

  const handleUpdate = useCallback(
    (id: string, update: TransactionUpdate) => {
      updateTransaction.mutate({ id, body: update });

      if (update.category_id && transactions) {
        const tx = transactions.find((t) => t.id === id);
        if (tx) {
          const categoryName = findCategoryName(categories, update.category_id);
          setRuleSuggestion({
            merchantClean: tx.merchant_clean,
            categoryId: update.category_id,
            categoryName,
          });
        }
      }
    },
    [updateTransaction, transactions, categories]
  );

  const handleAcceptRule = () => {
    if (!ruleSuggestion) return;
    createRule.mutate({
      pattern: ruleSuggestion.merchantClean,
      category_id: ruleSuggestion.categoryId,
    });
    setRuleSuggestion(null);
  };

  const handleSkipRule = () => {
    setRuleSuggestion(null);
  };

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

  return (
    <>
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
            txList.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                categories={categories}
                onUpdate={handleUpdate}
              />
            ))
          )}
        </div>
      </div>

      <Dialog open={!!ruleSuggestion} onOpenChange={(open) => !open && setRuleSuggestion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save categorization rule?</DialogTitle>
            <DialogDescription>
              Always categorize{" "}
              <span className="font-medium text-foreground">
                &ldquo;{ruleSuggestion?.merchantClean}&rdquo;
              </span>{" "}
              as{" "}
              <span className="font-medium text-foreground">
                &ldquo;{ruleSuggestion?.categoryName}&rdquo;
              </span>
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleSkipRule}>
              Skip
            </Button>
            <Button onClick={handleAcceptRule} disabled={createRule.isPending}>
              {createRule.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
