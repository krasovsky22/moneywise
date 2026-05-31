import { useState, useCallback } from "react";
import { Download, Plus, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TransactionFiltersBar } from "./TransactionFiltersBar";
import { TransactionTableRow } from "./TransactionTableRow";
import { BulkActionsBar } from "./BulkActionsBar";
import { TransactionModal } from "./TransactionModal";
import { AddTransactionModal } from "./AddTransactionModal";
import { useTransactionsGlobal, useUpdateTransaction, useDeleteTransaction, useBulkUpdate, useRestoreTransaction } from "./useTransactions";
import { buildExportUrl } from "./transactionsApi";
import { useCategories } from "@/features/categories/useCategories";
import type { TransactionFilters, SoftDeleteResponse } from "./transactionsApi";

const DEFAULT_FILTERS: TransactionFilters = {
  page: 1,
  page_size: 50,
  sort_by: "date",
  sort_order: "desc",
};

interface DeletedState {
  id: string;
  merchant: string;
  response: SoftDeleteResponse;
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>
      <span className="text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

function UndoBanner({
  deleted,
  onUndo,
  onDismiss,
}: {
  deleted: DeletedState;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg text-sm">
      <span>
        <span className="font-medium">{deleted.merchant}</span> deleted.
      </span>
      <Button variant="outline" size="sm" onClick={onUndo} className="gap-1.5">
        <RotateCcw className="h-3.5 w-3.5" />
        Undo
      </Button>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Dismiss undo banner"
      >
        ✕
      </button>
    </div>
  );
}

export const TransactionsPage = () => {
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalTxId, setModalTxId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletedState, setDeletedState] = useState<DeletedState | null>(null);

  const { data, isLoading, isError } = useTransactionsGlobal(filters);
  const { data: categories = [] } = useCategories();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();
  const bulkUpdateMutation = useBulkUpdate();
  const restoreMutation = useRestoreTransaction();

  const transactions = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;
  const total = data?.total ?? 0;

  const handleFilterChange = useCallback((next: TransactionFilters) => {
    setFilters(next);
    setSelectedIds(new Set());
  }, []);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleCategoryChange = (id: string, categoryId: string) => {
    updateMutation.mutate({ id, body: { category_id: categoryId } });
  };

  const handleDelete = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    deleteMutation.mutate(id, {
      onSuccess: (res) => {
        setDeletedState({ id, merchant: tx?.merchant_clean ?? "Transaction", response: res });
      },
      onError: () => toast.error("Failed to delete transaction."),
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    bulkUpdateMutation.mutate(
      { ids },
      {
        onSuccess: () => {
          toast.success(`${ids.length} transaction${ids.length !== 1 ? "s" : ""} deleted.`);
          setSelectedIds(new Set());
        },
        onError: () => toast.error("Bulk delete failed."),
      },
    );
  };

  const handleBulkRecategorize = (categoryId: string) => {
    const ids = Array.from(selectedIds);
    bulkUpdateMutation.mutate(
      { ids, category_id: categoryId },
      {
        onSuccess: (res) => {
          toast.success(`Updated ${res.updated_count} transaction${res.updated_count !== 1 ? "s" : ""}.`);
          setSelectedIds(new Set());
        },
        onError: () => toast.error("Bulk recategorize failed."),
      },
    );
  };

  const handleUndo = () => {
    if (!deletedState) return;
    restoreMutation.mutate(deletedState.id, {
      onSuccess: () => {
        toast.success(`${deletedState.merchant} restored.`);
        setDeletedState(null);
      },
      onError: () => toast.error("Failed to restore transaction."),
    });
  };

  const handleExport = () => {
    const { page: _page, page_size: _ps, ...exportFilters } = filters;
    const url = buildExportUrl(exportFilters);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
  };

  const allSelected =
    transactions.length > 0 && transactions.every((t) => selectedIds.has(t.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {total.toLocaleString()} total
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddModal(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add transaction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <TransactionFiltersBar filters={filters} onChange={handleFilterChange} />

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          onRecategorize={handleBulkRecategorize}
          onDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={allSelected}
                  data-state={someSelected ? "indeterminate" : undefined}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  aria-label="Select all transactions"
                />
              </th>
              <th className="w-[100px] px-3 py-2.5 text-xs font-medium text-muted-foreground">
                Date
              </th>
              <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
                Merchant
              </th>
              <th className="w-[110px] px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
                Amount
              </th>
              <th className="w-[90px] px-3 py-2.5 text-xs font-medium text-muted-foreground">
                Type
              </th>
              <th className="w-[180px] px-3 py-2.5 text-xs font-medium text-muted-foreground">
                Category
              </th>
              <th className="w-[90px] px-3 py-2.5 text-xs font-medium text-muted-foreground">
                Source
              </th>
              <th className="w-[80px] px-3 py-2.5 text-xs font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={8} className="py-16 text-center text-sm text-destructive">
                  Failed to load transactions.
                </td>
              </tr>
            )}
            {!isLoading && !isError && transactions.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                  No transactions found.
                </td>
              </tr>
            )}
            {transactions.map((tx) => (
              <TransactionTableRow
                key={tx.id}
                transaction={tx}
                categories={categories}
                selected={selectedIds.has(tx.id)}
                onSelect={handleSelect}
                onEdit={setModalTxId}
                onDelete={handleDelete}
                onCategoryChange={handleCategoryChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        page={filters.page ?? 1}
        totalPages={totalPages}
        onChange={(p) => setFilters((f) => ({ ...f, page: p }))}
      />

      {/* Edit modal */}
      <TransactionModal
        transactionId={modalTxId}
        open={!!modalTxId}
        onClose={() => setModalTxId(null)}
      />

      {/* Add modal */}
      <AddTransactionModal open={showAddModal} onClose={() => setShowAddModal(false)} />

      {/* Undo banner */}
      {deletedState && (
        <UndoBanner
          deleted={deletedState}
          onUndo={handleUndo}
          onDismiss={() => setDeletedState(null)}
        />
      )}
    </div>
  );
};
