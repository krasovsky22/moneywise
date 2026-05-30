import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listBankAccounts,
  getBankAccount,
  createBankAccount,
  updateBankAccount,
  archiveBankAccount,
  unarchiveBankAccount,
  type BankAccountCreate,
} from "./bankAccountsApi";

export const bankAccountKeys = {
  all: ["bank-accounts"] as const,
  list: (includeArchived?: boolean) =>
    [...bankAccountKeys.all, { includeArchived }] as const,
  detail: (id: string) => [...bankAccountKeys.all, id] as const,
};

export function useBankAccounts(includeArchived?: boolean) {
  return useQuery({
    queryKey: bankAccountKeys.list(includeArchived),
    queryFn: () => listBankAccounts(includeArchived),
  });
}

export function useBankAccount(id: string) {
  return useQuery({
    queryKey: bankAccountKeys.detail(id),
    queryFn: () => getBankAccount(id),
    enabled: !!id,
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BankAccountCreate) => createBankAccount(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bankAccountKeys.all });
    },
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BankAccountCreate> }) =>
      updateBankAccount(id, data),
    onSuccess: (_result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: bankAccountKeys.all });
      void queryClient.invalidateQueries({ queryKey: bankAccountKeys.detail(id) });
    },
  });
}

export function useArchiveBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveBankAccount(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bankAccountKeys.all });
    },
  });
}

export function useUnarchiveBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unarchiveBankAccount(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bankAccountKeys.all });
    },
  });
}
