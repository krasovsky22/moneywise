import { apiClient } from "@/lib/api-client";

export type TransactionType = "charge" | "payment" | "credit" | "refund";

export interface Transaction {
  id: string;
  statement_id: string;
  household_id: string;
  card_id: string | null;
  bank_account_id: string | null;
  date: string;
  amount: string;
  merchant_clean: string;
  merchant_raw: string;
  transaction_type: TransactionType;
  category_id: string | null;
  confidence_date: number | null;
  confidence_amount: number | null;
  confidence_merchant: number | null;
  confidence_category: number | null;
  is_user_confirmed: boolean;
  is_low_confidence: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TransactionUpdate {
  date?: string;
  amount?: string;
  merchant_clean?: string;
  category_id?: string | null;
  notes?: string;
}

export interface StatementConfirmResponse {
  confirmed_count: number;
}

export async function listTransactions(statementId: string): Promise<Transaction[]> {
  return apiClient.get(`api/v1/statements/${statementId}/transactions`).json<Transaction[]>();
}

export async function updateTransaction(
  id: string,
  body: TransactionUpdate,
  createRule = true,
): Promise<Transaction> {
  return apiClient
    .patch(`api/v1/transactions/${id}`, {
      json: body,
      searchParams: { create_rule: String(createRule) },
    })
    .json<Transaction>();
}

export async function confirmStatement(statementId: string): Promise<StatementConfirmResponse> {
  return apiClient
    .post(`api/v1/statements/${statementId}/confirm`)
    .json<StatementConfirmResponse>();
}
