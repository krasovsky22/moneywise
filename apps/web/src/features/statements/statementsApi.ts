import { apiClient } from "@/lib/api-client";

export type StatementStatus =
  | "queued"
  | "parsing"
  | "categorizing"
  | "needs_review"
  | "ready"
  | "failed";

export type FailureReason =
  | "unreadable_pdf"
  | "encrypted"
  | "unsupported_format"
  | "parsing_error"
  | "ai_unavailable";

export interface Statement {
  id: string;
  household_id: string;
  card_id: string | null;
  bank_account_id: string | null;
  uploaded_by_user_id: string | null;
  issuer_schema_id: string | null;
  file_hash: string;
  file_mime: string;
  file_size_bytes: number;
  file_original_name: string;
  period_start: string | null;
  period_end: string | null;
  status: StatementStatus;
  failure_reason: FailureReason | null;
  uploaded_at: string;
  processed_at: string | null;
  ai_cost_cents: number | null;
}

export interface StatementStatusResponse {
  id: string;
  status: StatementStatus;
  failure_reason: FailureReason | null;
  uploaded_at: string;
  processed_at: string | null;
}

export interface StatementUploadResponse {
  duplicate: boolean;
  statement: Statement | null;
  existing_statement_id: string | null;
  existing_uploaded_at: string | null;
}

export type AccountType = "card" | "bank_account";

export async function uploadStatement(
  file: File,
  accountType: AccountType,
  accountId: string,
  options?: { period_start?: string; period_end?: string }
): Promise<StatementUploadResponse> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("account_type", accountType);
  fd.append("account_id", accountId);
  if (options?.period_start) fd.append("period_start", options.period_start);
  if (options?.period_end) fd.append("period_end", options.period_end);
  return apiClient.post("api/v1/statements", { body: fd }).json<StatementUploadResponse>();
}

export async function listStatements(filters?: {
  status?: StatementStatus;
  card_id?: string;
  bank_account_id?: string;
}): Promise<Statement[]> {
  const searchParams: Record<string, string> = {};
  if (filters?.status) searchParams["status"] = filters.status;
  if (filters?.card_id) searchParams["card_id"] = filters.card_id;
  if (filters?.bank_account_id) searchParams["bank_account_id"] = filters.bank_account_id;
  return apiClient
    .get("api/v1/statements", { searchParams: Object.keys(searchParams).length ? searchParams : undefined })
    .json<Statement[]>();
}

export async function getStatement(id: string): Promise<Statement> {
  return apiClient.get(`api/v1/statements/${id}`).json<Statement>();
}

export async function getStatementStatus(id: string): Promise<StatementStatusResponse> {
  return apiClient.get(`api/v1/statements/${id}/status`).json<StatementStatusResponse>();
}

export async function deleteStatement(id: string): Promise<void> {
  await apiClient.delete(`api/v1/statements/${id}`);
}

export async function reprocessStatement(id: string): Promise<Statement> {
  return apiClient.post(`api/v1/statements/${id}/reprocess`).json<Statement>();
}

export async function fetchStatementFileBlob(id: string): Promise<Blob> {
  return apiClient.get(`api/v1/statements/${id}/file`).blob();
}
