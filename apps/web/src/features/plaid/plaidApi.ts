import { apiClient } from "@/lib/api-client";

export interface PlaidAccount {
  id: string;
  plaid_account_id: string | null;
  nickname: string;
  last4: string | null;
  account_type: string;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
}

export interface PlaidItem {
  id: string;
  institution_name: string;
  institution_logo_url: string | null;
  institution_color: string | null;
  status: "good" | "degraded" | "login_required" | "error";
  last_synced_at: string | null;
  accounts: PlaidAccount[];
}

export const plaidApi = {
  getLinkToken: () =>
    apiClient
      .post("api/v1/plaid/link/token")
      .json<{ link_token: string }>(),

  getUpdateModeLinkToken: (itemId: string) =>
    apiClient
      .post("api/v1/plaid/link/token", { json: { item_id: itemId } })
      .json<{ link_token: string }>(),

  exchangeToken: (data: {
    public_token: string;
    institution_id: string;
    institution_name: string;
  }) =>
    apiClient
      .post("api/v1/plaid/items", { json: data })
      .json<PlaidItem>(),

  listItems: () =>
    apiClient
      .get("api/v1/plaid/items")
      .json<PlaidItem[]>(),

  deleteItem: (id: string) =>
    apiClient.delete(`api/v1/plaid/items/${id}`),

  syncItem: (id: string) =>
    apiClient
      .post(`api/v1/plaid/items/${id}/sync`)
      .json<{ added: number; modified: number; removed: number }>(),
};
