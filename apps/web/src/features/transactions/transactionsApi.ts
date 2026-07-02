import { apiClient } from "@/lib/api-client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TransactionType = "expense" | "income" | "transfer" | "refund";
export type TransactionSource = "statement" | "manual" | "plaid";

export interface PlaidCounterparty {
  name: string;
  type: string;
  logo_url: string | null;
  website: string | null;
  entity_id: string | null;
  confidence_level: string | null;
}

export interface PlaidPersonalFinanceCategory {
  primary: string;
  detailed: string;
  confidence_level: string;
}

export interface PlaidRawMetadata {
  name: string | null;
  merchant_name: string | null;
  logo_url: string | null;
  merchant_entity_id: string | null;
  website: string | null;
  payment_channel: string | null;
  counterparties: PlaidCounterparty[] | null;
  personal_finance_category: PlaidPersonalFinanceCategory | null;
  personal_finance_category_icon_url: string | null;
  pending: boolean | null;
}

export interface Transaction {
  id: string;
  household_id: string;
  card_id: string | null;
  bank_account_id: string | null;
  date: string;
  amount: string;
  merchant_clean: string;
  merchant_raw: string;
  transaction_type: TransactionType;
  category_id: string | null;
  is_user_confirmed: boolean;
  is_low_confidence: boolean;
  notes: string | null;
  is_split: boolean;
  parent_transaction_id: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  source: TransactionSource;
  pending?: boolean;
  plaid_transaction_id?: string | null;
  plaid_raw_metadata?: PlaidRawMetadata | null;
  created_at: string;
  updated_at: string | null;
}

export interface TransactionDetail extends Transaction {
  children: Transaction[];
  audit_trail: TransactionAudit[];
}

export interface TransactionAudit {
  id: string;
  transaction_id: string;
  changed_by_user_id: string | null;
  changed_at: string;
  change_kind: "created" | "edited" | "categorized" | "split" | "deleted" | "undeleted";
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
}

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TransactionFilters {
  page?: number;
  page_size?: number;
  q?: string;
  date_from?: string;
  date_to?: string;
  card_ids?: string[];
  bank_account_ids?: string[];
  category_ids?: string[];
  amount_min?: string;
  amount_max?: string;
  is_user_confirmed?: boolean;
  source?: TransactionSource;
  transaction_type?: TransactionType[];
  sort_by?: "date" | "amount" | "merchant";
  sort_order?: "asc" | "desc";
  include_deleted?: boolean;
}

export interface TransactionUpdate {
  date?: string;
  amount?: string;
  merchant_clean?: string;
  category_id?: string | null;
  notes?: string | null;
  transaction_type?: TransactionType;
}

export interface TransactionCreate {
  date: string;
  amount: string;
  merchant_clean: string;
  merchant_raw?: string;
  transaction_type?: TransactionType;
  category_id?: string | null;
  card_id?: string | null;
  bank_account_id?: string | null;
  notes?: string | null;
}

export interface SplitPart {
  amount: string;
  merchant_clean?: string;
  category_id?: string | null;
  notes?: string | null;
}

export interface SplitRequest {
  parts: SplitPart[];
}

export interface SplitResponse {
  parent: Transaction;
  children: Transaction[];
}

export interface BulkUpdateRequest {
  ids: string[];
  category_id?: string | null;
  transaction_type?: TransactionType;
}

export interface BulkUpdateResponse {
  updated_count: number;
}

export interface SoftDeleteResponse {
  deleted: boolean;
  deleted_at: string;
  undo_until: string;
}

export interface MonthSummary {
  month: string; // "YYYY-MM"
  income: string;
  expense: string;
  refund: string;
  transfer: string;
  net: string; // income + refund - expense
  transaction_count: number;
}

export interface TransactionsSummary {
  date_from: string;
  date_to: string;
  months: MonthSummary[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSearchParams(filters: TransactionFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.page !== undefined) params.set("page", String(filters.page));
  if (filters.page_size !== undefined) params.set("page_size", String(filters.page_size));
  if (filters.q) params.set("q", filters.q);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.amount_min) params.set("amount_min", filters.amount_min);
  if (filters.amount_max) params.set("amount_max", filters.amount_max);
  if (filters.is_user_confirmed !== undefined)
    params.set("is_user_confirmed", String(filters.is_user_confirmed));
  if (filters.source) params.set("source", filters.source);
  if (filters.sort_by) params.set("sort_by", filters.sort_by);
  if (filters.sort_order) params.set("sort_order", filters.sort_order);
  if (filters.include_deleted) params.set("include_deleted", "true");

  filters.card_ids?.forEach((id) => params.append("card_ids", id));
  filters.bank_account_ids?.forEach((id) => params.append("bank_account_ids", id));
  filters.category_ids?.forEach((id) => params.append("category_ids", id));
  filters.transaction_type?.forEach((t) => params.append("transaction_type", t));

  return params;
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function listTransactionsGlobal(
  filters: TransactionFilters,
): Promise<PaginatedTransactions> {
  return apiClient
    .get("api/v1/transactions", { searchParams: buildSearchParams(filters) })
    .json<PaginatedTransactions>();
}

export async function getTransactionsSummary(
  dateFrom: string,
  dateTo: string,
): Promise<TransactionsSummary> {
  return apiClient
    .get("api/v1/transactions/summary", {
      searchParams: { date_from: dateFrom, date_to: dateTo },
    })
    .json<TransactionsSummary>();
}

export async function getTransactionDetail(id: string): Promise<TransactionDetail> {
  return apiClient.get(`api/v1/transactions/${id}`).json<TransactionDetail>();
}

export async function createTransaction(body: TransactionCreate): Promise<Transaction> {
  return apiClient.post("api/v1/transactions", { json: body }).json<Transaction>();
}

export async function updateTransaction(
  id: string,
  body: TransactionUpdate,
  createRule = false,
): Promise<Transaction> {
  return apiClient
    .patch(`api/v1/transactions/${id}`, {
      json: body,
      searchParams: { create_rule: String(createRule) },
    })
    .json<Transaction>();
}

export async function splitTransaction(id: string, body: SplitRequest): Promise<SplitResponse> {
  return apiClient.post(`api/v1/transactions/${id}/split`, { json: body }).json<SplitResponse>();
}

export async function bulkUpdateTransactions(body: BulkUpdateRequest): Promise<BulkUpdateResponse> {
  return apiClient
    .post("api/v1/transactions/bulk-update", { json: body })
    .json<BulkUpdateResponse>();
}

export async function deleteTransaction(id: string): Promise<SoftDeleteResponse> {
  return apiClient.delete(`api/v1/transactions/${id}`).json<SoftDeleteResponse>();
}

export async function restoreTransaction(id: string): Promise<Transaction> {
  return apiClient.post(`api/v1/transactions/${id}/restore`).json<Transaction>();
}

export function buildExportUrl(
  filters: Omit<TransactionFilters, "page" | "page_size">,
): string {
  const params = buildSearchParams(filters);
  const base = (import.meta.env.VITE_API_URL ?? "") as string;
  const qs = params.toString();
  return `${base}/api/v1/transactions/export${qs ? `?${qs}` : ""}`;
}

