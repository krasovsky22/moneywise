import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryPicker } from "./CategoryPicker";
import { useCategories } from "@/features/categories/useCategories";
import { useCards } from "@/features/cards/useCards";
import { useCreateTransaction } from "./useTransactions";
import type { TransactionType } from "./transactionsApi";

interface AddTransactionModalProps {
  open: boolean;
  onClose: () => void;
}

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
  { value: "refund", label: "Refund" },
];

export const AddTransactionModal = ({ open, onClose }: AddTransactionModalProps) => {
  const { data: categories = [] } = useCategories();
  const { data: cards = [] } = useCards();
  const createMutation = useCreateTransaction();

  const [date, setDate] = useState(todayIso);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [txType, setTxType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const reset = () => {
    setDate(todayIso());
    setAmount("");
    setMerchant("");
    setTxType("expense");
    setCategoryId(null);
    setCardId(null);
    setNotes("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!date || !amount || !merchant) {
      toast.error("Date, amount, and merchant are required.");
      return;
    }

    createMutation.mutate(
      {
        date,
        amount,
        merchant_clean: merchant,
        transaction_type: txType,
        category_id: categoryId || null,
        card_id: cardId || null,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          toast.success("Transaction created.");
          handleClose();
        },
        onError: () => {
          toast.error("Failed to create transaction.");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription className="sr-only">Create a manual transaction entry</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="add-date" className="text-xs">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-amount" className="text-xs">
                Amount <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-amount"
                type="number"
                step="0.01"
                placeholder="-50.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-merchant" className="text-xs">
              Merchant <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-merchant"
              placeholder="e.g. Amazon, Starbucks…"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="h-9"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={txType}
                onValueChange={(v) => setTxType(v as TransactionType)}
              >
                <SelectTrigger className="h-9" aria-label="Transaction type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <CategoryPicker
                value={categoryId}
                onChange={setCategoryId}
                categories={categories}
              />
            </div>
          </div>

          {cards.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Card (optional)</Label>
              <Select
                value={cardId ?? "none"}
                onValueChange={(v) => setCardId(v === "none" ? null : v)}
              >
                <SelectTrigger className="h-9" aria-label="Card">
                  <SelectValue placeholder="No card" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No card</SelectItem>
                  {cards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.nickname} ••{card.last4}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="add-notes" className="text-xs">Notes</Label>
            <Textarea
              id="add-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Add transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
