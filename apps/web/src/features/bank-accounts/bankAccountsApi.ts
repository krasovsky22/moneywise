import { apiClient } from "@/lib/api-client";

export type AccountType = "checking" | "savings" | "money_market" | "other";

export interface BankAccount {
  id: string;
  household_id: string;
  nickname: string;
  institution: string;
  account_type: AccountType;
  last4: string | null;
  color: string | null;
  icon: string | null;
  is_shared: boolean;
  is_archived: boolean;
  created_at: string;
  archived_at: string | null;
}

export interface BankAccountCreate {
  nickname: string;
  institution: string;
  account_type: AccountType;
  last4?: string;
  color?: string;
  icon?: string;
  is_shared?: boolean;
}

export async function listBankAccounts(includeArchived?: boolean): Promise<BankAccount[]> {
  const searchParams = includeArchived ? { include_archived: "true" } : undefined;
  return apiClient
    .get("api/v1/bank-accounts", { searchParams })
    .json<BankAccount[]>();
}

export async function getBankAccount(id: string): Promise<BankAccount> {
  return apiClient.get(`api/v1/bank-accounts/${id}`).json<BankAccount>();
}

export async function createBankAccount(data: BankAccountCreate): Promise<BankAccount> {
  return apiClient.post("api/v1/bank-accounts", { json: data }).json<BankAccount>();
}

export async function updateBankAccount(
  id: string,
  data: Partial<BankAccountCreate>
): Promise<BankAccount> {
  return apiClient
    .patch(`api/v1/bank-accounts/${id}`, { json: data })
    .json<BankAccount>();
}

export async function archiveBankAccount(id: string): Promise<BankAccount> {
  return apiClient.post(`api/v1/bank-accounts/${id}/archive`).json<BankAccount>();
}

export async function unarchiveBankAccount(id: string): Promise<BankAccount> {
  return apiClient.post(`api/v1/bank-accounts/${id}/unarchive`).json<BankAccount>();
}
