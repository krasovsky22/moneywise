import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listTransactionsGlobal,
  getTransactionsSummary,
  getTransactionDetail,
  createTransaction,
  updateTransaction,
  splitTransaction,
  bulkUpdateTransactions,
  deleteTransaction,
  restoreTransaction,
  type TransactionFilters,
  type TransactionUpdate,
  type TransactionCreate,
  type SplitRequest,
  type BulkUpdateRequest,
} from "./transactionsApi";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionKeys.all, "list"] as const,
  list: (filters: TransactionFilters) => [...transactionKeys.lists(), filters] as const,
  detail: (id: string) => [...transactionKeys.all, "detail", id] as const,
  summary: (dateFrom: string, dateTo: string) =>
    [...transactionKeys.all, "summary", dateFrom, dateTo] as const,
};

// ─── Global list ─────────────────────────────────────────────────────────────

export function useTransactionsGlobal(filters: TransactionFilters) {
  return useQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: () => listTransactionsGlobal(filters),
  });
}

// ─── Monthly summary ─────────────────────────────────────────────────────────

export function useTransactionsSummary(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: transactionKeys.summary(dateFrom, dateTo),
    queryFn: () => getTransactionsSummary(dateFrom, dateTo),
  });
}

// ─── Detail ──────────────────────────────────────────────────────────────────

export function useTransactionDetail(id: string | null) {
  return useQuery({
    queryKey: transactionKeys.detail(id ?? ""),
    queryFn: () => getTransactionDetail(id!),
    enabled: !!id,
  });
}

// ─── Create ──────────────────────────────────────────────────────────────────

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TransactionCreate) => createTransaction(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

// ─── Update ──────────────────────────────────────────────────────────────────

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
      createRule = false,
    }: {
      id: string;
      body: TransactionUpdate;
      createRule?: boolean;
    }) => updateTransaction(id, body, createRule),
    onSuccess: (_result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: transactionKeys.detail(id) });
    },
  });
}

// ─── Split ───────────────────────────────────────────────────────────────────

export function useSplitTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SplitRequest }) =>
      splitTransaction(id, body),
    onSuccess: (_result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: transactionKeys.detail(id) });
    },
  });
}

// ─── Bulk update ─────────────────────────────────────────────────────────────

export function useBulkUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkUpdateRequest) => bulkUpdateTransactions(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

// ─── Restore ─────────────────────────────────────────────────────────────────

export function useRestoreTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

