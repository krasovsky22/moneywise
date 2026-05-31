import { useCallback, useRef, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionUpdate } from "./transactionsApi";
import type { Category } from "@/features/categories/categoriesApi";
import { CategoryPicker } from "./CategoryPicker";

interface TransactionRowProps {
  transaction: Transaction;
  categories: Category[];
  onUpdate: (id: string, update: TransactionUpdate) => void;
  hasCategoryConflict?: boolean;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  charge: { label: "Charge", variant: "secondary" },
  payment: { label: "Payment", variant: "outline" },
  credit: { label: "Credit", variant: "default" },
  refund: { label: "Refund", variant: "outline" },
};

function formatCurrency(amount: string): string {
  const num = parseFloat(amount);
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export const TransactionRow = ({
  transaction,
  categories,
  onUpdate,
  hasCategoryConflict = false,
}: TransactionRowProps) => {
  const [merchantValue, setMerchantValue] = useState(transaction.merchant_clean);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMerchantChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setMerchantValue(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate(transaction.id, { merchant_clean: val });
      }, 300);
    },
    [transaction.id, onUpdate]
  );

  const handleMerchantBlur = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (merchantValue !== transaction.merchant_clean) {
      onUpdate(transaction.id, { merchant_clean: merchantValue });
    }
  }, [merchantValue, transaction.id, transaction.merchant_clean, onUpdate]);

  const handleCategoryChange = useCallback(
    (categoryId: string) => {
      onUpdate(transaction.id, { category_id: categoryId });
    },
    [transaction.id, onUpdate]
  );

  const amount = parseFloat(transaction.amount);
  const isExpense = amount < 0;
  const typeConfig = TYPE_CONFIG[transaction.transaction_type] ?? {
    label: transaction.transaction_type,
    variant: "secondary" as const,
  };

  return (
    <div
      className={cn(
        "grid grid-cols-[100px_1fr_100px_90px_180px_40px] items-center gap-3 border-b px-4 py-2 last:border-b-0",
        transaction.is_low_confidence && "border-l-2 border-l-amber-400 bg-amber-50/40 dark:bg-amber-950/20"
      )}
    >
      <span className="text-xs tabular-nums text-muted-foreground">{transaction.date}</span>

      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <Input
            value={merchantValue}
            onChange={handleMerchantChange}
            onBlur={handleMerchantBlur}
            className="h-7 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-1"
            aria-label={`Merchant name for transaction on ${transaction.date}`}
          />
          {hasCategoryConflict && (
            <span title="Multiple categories for this merchant">
              <TriangleAlert
                className="h-3.5 w-3.5 shrink-0 text-amber-500"
                aria-label="Multiple categories for this merchant"
              />
            </span>
          )}
        </div>
        {transaction.merchant_raw !== transaction.merchant_clean && (
          <p className="truncate px-1 text-[10px] text-muted-foreground/60">
            {transaction.merchant_raw}
          </p>
        )}
      </div>

      <span
        className={cn(
          "text-right text-sm tabular-nums font-medium",
          isExpense ? "text-destructive" : "text-green-600 dark:text-green-400"
        )}
      >
        {formatCurrency(transaction.amount)}
      </span>

      <Badge variant={typeConfig.variant} className="justify-center text-[10px]">
        {typeConfig.label}
      </Badge>

      <CategoryPicker
        value={transaction.category_id}
        onChange={handleCategoryChange}
        categories={categories}
      />

      <div className="flex justify-center">
        {transaction.is_user_confirmed && (
          <Check className="h-4 w-4 text-green-500" aria-label="Confirmed" />
        )}
      </div>
    </div>
  );
};
