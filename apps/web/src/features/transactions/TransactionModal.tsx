import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, GitBranch, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CategoryPicker } from "./CategoryPicker";
import { SplitTransactionModal } from "./SplitTransactionModal";
import { useCategories } from "@/features/categories/useCategories";
import {
  useTransactionDetail,
  useUpdateTransaction,
  useDeleteTransaction,
} from "./useTransactions";
import type { TransactionType, TransactionAudit } from "./transactionsApi";

interface TransactionModalProps {
  transactionId: string | null;
  open: boolean;
  onClose: () => void;
}

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
  { value: "refund", label: "Refund" },
];

const CHANGE_KIND_VARIANT: Record<
  TransactionAudit["change_kind"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  created: "default",
  edited: "secondary",
  categorized: "secondary",
  split: "outline",
  deleted: "destructive",
  undeleted: "outline",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function ConfidenceBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} confidence: ${pct}%`}
        />
      </div>
    </div>
  );
}

export const TransactionModal = ({ transactionId, open, onClose }: TransactionModalProps) => {
  const { data: detail, isLoading, isError } = useTransactionDetail(transactionId);
  const { data: categories = [] } = useCategories();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const [splitOpen, setSplitOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Local form state
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [txType, setTxType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (detail) {
      setDate(detail.date);
      setAmount(detail.amount);
      setMerchant(detail.merchant_clean);
      setTxType(detail.transaction_type);
      setCategoryId(detail.category_id);
      setNotes(detail.notes ?? "");
      setConfirmDelete(false);
    }
  }, [detail]);

  const handleSave = () => {
    if (!transactionId) return;
    updateMutation.mutate(
      {
        id: transactionId,
        body: {
          date,
          amount,
          merchant_clean: merchant,
          transaction_type: txType,
          category_id: categoryId,
          notes: notes || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Transaction updated.");
          onClose();
        },
        onError: () => {
          toast.error("Failed to update transaction.");
        },
      },
    );
  };

  const handleDelete = () => {
    if (!transactionId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteMutation.mutate(transactionId, {
      onSuccess: () => {
        toast.success("Transaction deleted.");
        onClose();
      },
      onError: () => {
        toast.error("Failed to delete transaction.");
      },
    });
  };

  const title = detail?.merchant_clean ?? "Transaction Details";
  const canSplit = detail && !detail.is_split && !detail.is_deleted;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{title}</DialogTitle>
            <DialogDescription className="sr-only">View and edit transaction details</DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {isError && (
            <p className="py-8 text-center text-sm text-destructive">
              Failed to load transaction details.
            </p>
          )}

          {detail && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="history">
                  History
                  {detail.audit_trail.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px]">
                      {detail.audit_trail.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="tx-date" className="text-xs">Date</Label>
                    <Input
                      id="tx-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tx-amount" className="text-xs">Amount</Label>
                    <Input
                      id="tx-amount"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tx-merchant" className="text-xs">Merchant</Label>
                  <Input
                    id="tx-merchant"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="h-9"
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

                <div className="space-y-1.5">
                  <Label htmlFor="tx-notes" className="text-xs">Notes</Label>
                  <Textarea
                    id="tx-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Add a note…"
                    className="resize-none text-sm"
                  />
                </div>

                <Separator />

                {/* Read-only metadata */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground">Source</span>
                    <div>
                      <Badge
                        variant={detail.source === "statement" ? "outline" : "secondary"}
                        className="text-[10px] capitalize"
                      >
                        {detail.source}
                      </Badge>
                    </div>
                  </div>
                  {detail.statement_id && (
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground">Statement</span>
                      <div>
                        <Link
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          to={`/secure/statements/${detail.statement_id}` as any}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          onClick={onClose}
                        >
                          View statement
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confidence scores */}
                {(detail.confidence_date !== null ||
                  detail.confidence_amount !== null ||
                  detail.confidence_merchant !== null ||
                  detail.confidence_category !== null) && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">AI Confidence</p>
                    <div className="space-y-2 rounded-md border p-3">
                      <ConfidenceBar label="Date" value={detail.confidence_date} />
                      <ConfidenceBar label="Amount" value={detail.confidence_amount} />
                      <ConfidenceBar label="Merchant" value={detail.confidence_merchant} />
                      <ConfidenceBar label="Category" value={detail.confidence_category} />
                    </div>
                  </div>
                )}

                {/* Split children */}
                {detail.is_split && detail.children.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">
                        Split parts ({detail.children.length})
                      </p>
                    </div>
                    <div className="space-y-1 rounded-md border divide-y">
                      {detail.children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between px-3 py-2 text-xs"
                        >
                          <span>{child.merchant_clean}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "USD",
                            }).format(parseFloat(child.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-3">
                {detail.audit_trail.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No history yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {[...detail.audit_trail]
                      .sort(
                        (a, b) =>
                          new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
                      )
                      .map((entry) => (
                        <div key={entry.id} className="flex gap-3 text-xs">
                          <div className="flex flex-col items-center gap-1">
                            <div className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/40" />
                            <div className="w-px flex-1 bg-border" />
                          </div>
                          <div className="pb-3 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={CHANGE_KIND_VARIANT[entry.change_kind]}
                                className="text-[10px] capitalize"
                              >
                                {entry.change_kind}
                              </Badge>
                              <span className="text-muted-foreground">
                                {formatDateTime(entry.changed_at)}
                              </span>
                            </div>
                            {entry.change_kind === "edited" &&
                              entry.before_data &&
                              entry.after_data && (
                                <div className="rounded-md bg-muted/50 p-2 space-y-1 text-[11px]">
                                  {Object.keys(entry.after_data).map((key) => {
                                    const before = entry.before_data?.[key];
                                    const after = entry.after_data?.[key];
                                    if (before === after) return null;
                                    return (
                                      <div key={key} className="flex gap-1.5">
                                        <span className="text-muted-foreground w-20 shrink-0">
                                          {key}
                                        </span>
                                        <span className="line-through text-muted-foreground/60">
                                          {String(before ?? "—")}
                                        </span>
                                        <span className="text-muted-foreground">→</span>
                                        <span>{String(after ?? "—")}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {detail && (
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="flex gap-2">
                {canSplit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSplitOpen(true)}
                    disabled={updateMutation.isPending}
                  >
                    Split
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={
                    confirmDelete
                      ? "border-destructive text-destructive hover:bg-destructive/10"
                      : "text-muted-foreground hover:text-destructive"
                  }
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending || detail.is_deleted}
                >
                  {confirmDelete ? "Confirm delete?" : "Delete"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending || detail.is_deleted}
                >
                  {updateMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <SplitTransactionModal
        transaction={detail ?? null}
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
      />
    </>
  );
};
