import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listTransactions,
  updateTransaction,
  confirmStatement,
  type TransactionUpdate,
} from "./transactionsApi";
import { statementKeys } from "../statements/useStatements";

export const transactionKeys = {
  all: ["transactions"] as const,
  forStatement: (statementId: string) =>
    [...transactionKeys.all, "statement", statementId] as const,
};

export function useTransactions(statementId: string) {
  return useQuery({
    queryKey: transactionKeys.forStatement(statementId),
    queryFn: () => listTransactions(statementId),
    enabled: !!statementId,
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TransactionUpdate }) =>
      updateTransaction(id, body),
    onSuccess: () => {
      // Invalidate all transaction lists (we don't know the statementId here without context,
      // so invalidate the broader key)
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
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
