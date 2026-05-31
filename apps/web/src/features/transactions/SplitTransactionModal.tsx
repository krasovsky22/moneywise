import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CategoryPicker } from "./CategoryPicker";
import { useCategories } from "@/features/categories/useCategories";
import { useSplitTransaction } from "./useTransactions";
import { cn } from "@/lib/utils";
import type { Transaction, SplitPart } from "./transactionsApi";

interface SplitTransactionModalProps {
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
}

interface PartRow {
  amount: string;
  merchant_clean: string;
  category_id: string | null;
  notes: string;
}

function formatCurrency(amount: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(num));
}

export const SplitTransactionModal = ({
  transaction,
  open,
  onClose,
}: SplitTransactionModalProps) => {
  const { data: categories = [] } = useCategories();
  const splitMutation = useSplitTransaction();

  const defaultPart = (): PartRow => ({
    amount: "",
    merchant_clean: transaction?.merchant_clean ?? "",
    category_id: transaction?.category_id ?? null,
    notes: "",
  });

  const [parts, setParts] = useState<PartRow[]>([defaultPart(), defaultPart()]);

  if (!transaction) return null;

  const totalAbs = Math.abs(parseFloat(transaction.amount));
  const allocatedSum = parts.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const remaining = totalAbs - allocatedSum;
  const isBalanced = Math.abs(remaining) < 0.01;

  const updatePart = (index: number, field: keyof PartRow, value: string | null) => {
    setParts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value ?? "" } : p)),
    );
  };

  const addPart = () => setParts((prev) => [...prev, defaultPart()]);

  const removePart = (index: number) => {
    if (parts.length <= 2) return;
    setParts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!isBalanced) {
      toast.error("Parts must sum to the original amount.");
      return;
    }
    const splitParts: SplitPart[] = parts.map((p) => ({
      amount: parseFloat(transaction.amount) < 0
        ? String(-Math.abs(parseFloat(p.amount)))
        : p.amount,
      merchant_clean: p.merchant_clean || transaction.merchant_clean,
      category_id: p.category_id || null,
      notes: p.notes || null,
    }));

    splitMutation.mutate(
      { id: transaction.id, body: { parts: splitParts } },
      {
        onSuccess: () => {
          toast.success("Transaction split successfully.");
          onClose();
          setParts([defaultPart(), defaultPart()]);
        },
        onError: () => {
          toast.error("Failed to split transaction.");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Split Transaction</DialogTitle>
          <DialogDescription className="sr-only">Split this transaction into multiple parts</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm">
            <span className="font-medium">{transaction.merchant_clean}</span>
            <span className="ml-2 text-muted-foreground">
              — {formatCurrency(transaction.amount)} total
            </span>
          </div>

          <div className="space-y-3">
            {parts.map((part, i) => (
              <div key={i} className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Part {i + 1}
                  </span>
                  {parts.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removePart(i)}
                      aria-label={`Remove part ${i + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={part.amount}
                      onChange={(e) => updatePart(i, "amount", e.target.value)}
                      className="h-8 text-sm"
                      aria-label={`Amount for part ${i + 1}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Merchant</Label>
                    <Input
                      placeholder={transaction.merchant_clean}
                      value={part.merchant_clean}
                      onChange={(e) => updatePart(i, "merchant_clean", e.target.value)}
                      className="h-8 text-sm"
                      aria-label={`Merchant for part ${i + 1}`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <CategoryPicker
                    value={part.category_id}
                    onChange={(id) => updatePart(i, "category_id", id)}
                    categories={categories}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Input
                    placeholder="Optional notes…"
                    value={part.notes}
                    onChange={(e) => updatePart(i, "notes", e.target.value)}
                    className="h-8 text-sm"
                    aria-label={`Notes for part ${i + 1}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={addPart}>
            <Plus className="h-4 w-4" />
            Add part
          </Button>

          {/* Remaining balance */}
          <div
            className={cn(
              "flex items-center justify-between rounded-md px-4 py-2.5 text-sm font-medium",
              isBalanced
                ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400",
            )}
          >
            <span>Remaining</span>
            <span>
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                remaining,
              )}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isBalanced || splitMutation.isPending}>
            {splitMutation.isPending ? "Splitting…" : "Split transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
