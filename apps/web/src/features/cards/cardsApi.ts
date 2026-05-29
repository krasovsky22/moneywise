import { apiClient } from "@/lib/api-client";

export type CardNetwork = "visa" | "mastercard" | "amex" | "discover" | "other";

export interface Card {
  id: string;
  household_id: string;
  nickname: string;
  issuer: string;
  last4: string;
  network: CardNetwork | null;
  color: string | null;
  icon: string | null;
  statement_close_day: number;
  payment_due_day: number;
  minimum_payment_cents: number | null;
  is_shared: boolean;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  archived_at: string | null;
}

export interface CardCreate {
  nickname: string;
  issuer: string;
  last4: string;
  network?: CardNetwork;
  color?: string;
  icon?: string;
  statement_close_day: number;
  payment_due_day: number;
  minimum_payment_cents?: number;
  is_shared?: boolean;
  is_default?: boolean;
}

export async function listCards(includeArchived?: boolean): Promise<Card[]> {
  const searchParams = includeArchived ? { include_archived: "true" } : undefined;
  return apiClient
    .get("api/v1/cards", { searchParams })
    .json<Card[]>();
}

export async function getCard(cardId: string): Promise<Card> {
  return apiClient.get(`api/v1/cards/${cardId}`).json<Card>();
}

export async function createCard(data: CardCreate): Promise<Card> {
  return apiClient.post("api/v1/cards", { json: data }).json<Card>();
}

export async function updateCard(
  cardId: string,
  data: Partial<CardCreate>
): Promise<Card> {
  return apiClient
    .patch(`api/v1/cards/${cardId}`, { json: data })
    .json<Card>();
}

export async function archiveCard(cardId: string): Promise<Card> {
  return apiClient.post(`api/v1/cards/${cardId}/archive`).json<Card>();
}

export async function unarchiveCard(cardId: string): Promise<Card> {
  return apiClient.post(`api/v1/cards/${cardId}/unarchive`).json<Card>();
}
