import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listStatements,
  getStatement,
  getStatementStatus,
  uploadStatement,
  deleteStatement,
  reprocessStatement,
  type StatementStatus,
  type AccountType,
} from "./statementsApi";

export const statementKeys = {
  all: ["statements"] as const,
  list: (filters?: { status?: StatementStatus; card_id?: string; bank_account_id?: string }) =>
    [...statementKeys.all, filters] as const,
  detail: (id: string) => [...statementKeys.all, id] as const,
  status: (id: string) => [...statementKeys.all, id, "status"] as const,
};

export function useStatements(filters?: {
  status?: StatementStatus;
  card_id?: string;
  bank_account_id?: string;
}) {
  return useQuery({
    queryKey: statementKeys.list(filters),
    queryFn: () => listStatements(filters),
  });
}

export function useStatement(id: string) {
  return useQuery({
    queryKey: statementKeys.detail(id),
    queryFn: () => getStatement(id),
    enabled: !!id,
  });
}

export function useStatementStatus(id: string, enabled?: boolean) {
  return useQuery({
    queryKey: statementKeys.status(id),
    queryFn: () => getStatementStatus(id),
    enabled: !!id && (enabled ?? true),
    refetchInterval: 3000,
  });
}

export function useUploadStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      accountType,
      accountId,
      options,
    }: {
      file: File;
      accountType: AccountType;
      accountId: string;
      options?: { period_start?: string; period_end?: string };
    }) => uploadStatement(file, accountType, accountId, options),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: statementKeys.all });
    },
  });
}

export function useDeleteStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStatement(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: statementKeys.all });
    },
  });
}

export function useReprocessStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reprocessStatement(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: statementKeys.detail(id) });
    },
  });
}
