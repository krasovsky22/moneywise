import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listTransactions,
  listTransactionsGlobal,
  getTransactionDetail,
  createTransaction,
  updateTransaction,
  splitTransaction,
  bulkUpdateTransactions,
  deleteTransaction,
  restoreTransaction,
  confirmStatement,
  type TransactionFilters,
  type TransactionUpdate,
  type TransactionCreate,
  type SplitRequest,
  type BulkUpdateRequest,
} from "./transactionsApi";
import { statementKeys } from "../statements/useStatements";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionKeys.all, "list"] as const,
  list: (filters: TransactionFilters) => [...transactionKeys.lists(), filters] as const,
  detail: (id: string) => [...transactionKeys.all, "detail", id] as const,
  forStatement: (statementId: string) =>
    [...transactionKeys.all, "statement", statementId] as const,
};

// ─── Global list ─────────────────────────────────────────────────────────────

export function useTransactionsGlobal(filters: TransactionFilters) {
  return useQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: () => listTransactionsGlobal(filters),
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
      void queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
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
      void queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
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
      void queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
    },
  });
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
    },
  });
}

// ─── Restore ─────────────────────────────────────────────────────────────────

export function useRestoreTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
    },
  });
}

// ─── Backward-compat hooks (used by StatementReview) ─────────────────────────

export function useTransactions(statementId: string) {
  return useQuery({
    queryKey: transactionKeys.forStatement(statementId),
    queryFn: () => listTransactions(statementId),
    enabled: !!statementId,
  });
}

export function useConfirmStatement(statementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => confirmStatement(statementId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: transactionKeys.forStatement(statementId),
      });
      void queryClient.invalidateQueries({
        queryKey: statementKeys.detail(statementId),
      });
      void queryClient.invalidateQueries({ queryKey: statementKeys.all });
    },
  });
}
