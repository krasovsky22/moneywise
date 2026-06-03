import { Pencil, Trash2, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryPicker } from "./CategoryPicker";
import { MerchantCell } from "./MerchantCell";
import { cn } from "@/lib/utils";
import type { Transaction } from "./transactionsApi";
import type { Category } from "@/features/categories/categoriesApi";
import type { Card } from "@/features/cards/cardsApi";
import type { BankAccount } from "@/features/bank-accounts/bankAccountsApi";
interface TransactionTableRowProps {
  transaction: Transaction;
  categories: Category[];
  cards: Card[];
  bankAccounts: BankAccount[];
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onCategoryChange: (id: string, categoryId: string) => void;
  onSourceFilter?: (source: string) => void;
}

const TYPE_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  expense: "secondary",
  income: "default",
  transfer: "outline",
  refund: "outline",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function formatCurrency(amount: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

export const TransactionTableRow = ({
  transaction,
  categories,
  cards,
  bankAccounts,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onCategoryChange,
  onSourceFilter,
}: TransactionTableRowProps) => {
  const typeVariant = TYPE_VARIANT[transaction.transaction_type] ?? "secondary";

  const amountColor =
    transaction.transaction_type === "expense"
      ? "text-destructive"
      : transaction.transaction_type === "income"
        ? "text-green-600 dark:text-green-400"
        : "";

  const sourceLabel = (() => {
    if (transaction.card_id) {
      const card = cards.find((c) => c.id === transaction.card_id);
      if (card) return `${card.nickname}${card.last4 ? ` ••${card.last4}` : ""}`;
    }
    if (transaction.bank_account_id) {
      const acct = bankAccounts.find((a) => a.id === transaction.bank_account_id);
      if (acct) return `${acct.nickname}${acct.last4 ? ` ••${acct.last4}` : ""}`;
    }
    return null;
  })();

  return (
    <tr
      className={cn(
        "border-b transition-colors hover:bg-muted/30 last:border-b-0",
        transaction.is_low_confidence && "border-l-2 border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/10",
        transaction.is_deleted && "opacity-50",
      )}
    >
      {/* Checkbox */}
      <td className="w-10 px-3 py-2">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(transaction.id, !!checked)}
          aria-label={`Select transaction ${transaction.merchant_clean}`}
        />
      </td>

      {/* Date */}
      <td className="w-[100px] px-3 py-2 text-xs tabular-nums text-muted-foreground">
        {formatDate(transaction.date)}
      </td>

      {/* Merchant */}
      <td className="px-3 py-2">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {transaction.is_split && (
              <GitBranch
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-label="Split transaction"
              />
            )}
            <MerchantCell
              merchantName={transaction.merchant_clean}
              plaidMetadata={transaction.plaid_raw_metadata}
              isDeleted={transaction.is_deleted}
              isPending={transaction.pending}
            />
            {transaction.pending && (
              <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                Pending
              </Badge>
            )}
          </div>
          <button
            onClick={() => onSourceFilter?.(transaction.source)}
            className="shrink-0"
            title={`Filter by source: ${transaction.source}`}
            aria-label={`Filter by source ${transaction.source}`}
          >
            <Badge
              className="text-[10px] capitalize cursor-pointer bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
            >
              {sourceLabel ?? transaction.source}
            </Badge>
          </button>
        </div>
        {transaction.merchant_raw !== transaction.merchant_clean && (
          <p className="truncate text-[10px] text-muted-foreground/60">
            {transaction.merchant_raw}
          </p>
        )}
      </td>

      {/* Amount */}
      <td className="w-[110px] px-3 py-2 text-right">
        <span
          className={cn("text-sm tabular-nums font-medium", amountColor)}
        >
          {formatCurrency(transaction.amount)}
        </span>
      </td>

      {/* Type */}
      <td className="w-[90px] px-3 py-2">
        <Badge variant={typeVariant} className="text-[10px] capitalize">
          {transaction.transaction_type}
        </Badge>
      </td>

      {/* Category */}
      <td className="w-[180px] px-3 py-2">
        <CategoryPicker
          value={transaction.category_id}
          onChange={(id) => onCategoryChange(transaction.id, id)}
          categories={categories}
          disabled={transaction.is_deleted}
        />
      </td>

      {/* Actions */}
      <td className="w-[80px] px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(transaction.id)}
            aria-label={`Edit ${transaction.merchant_clean}`}
            disabled={transaction.is_deleted}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(transaction.id)}
            aria-label={`Delete ${transaction.merchant_clean}`}
            disabled={transaction.is_deleted}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
};
