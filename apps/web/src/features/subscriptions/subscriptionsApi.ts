import { apiClient } from "@/lib/api-client";

export type SubscriptionFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export type SubscriptionStatus =
  | "pending_review"
  | "active"
  | "paused"
  | "cancelled"
  | "dismissed";

export type SubscriptionSource = "detected" | "manual";

export interface Subscription {
  id: string;
  household_id: string;
  merchant_clean: string;
  amount_typical: string;
  currency: string;
  frequency: SubscriptionFrequency;
  anchor_day: number | null;
  status: SubscriptionStatus;
  next_expected_charge_date: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  notes: string | null;
  source: SubscriptionSource;
  created_at: string;
  updated_at: string | null;
}

export interface SubscriptionCharge {
  id: string;
  subscription_id: string;
  transaction_id: string;
  occurred_on: string;
  amount: string;
  deviation_from_typical: string;
}

export interface SubscriptionCreate {
  merchant_clean: string;
  amount_typical: string;
  currency?: string;
  frequency: SubscriptionFrequency;
  next_expected_charge_date?: string;
  notes?: string;
}

export interface SubscriptionUpdate {
  merchant_clean?: string;
  amount_typical?: string;
  frequency?: SubscriptionFrequency;
  status?: SubscriptionStatus;
  next_expected_charge_date?: string;
  notes?: string;
}

export interface DetectionRunResult {
  created: number;
  updated: number;
  charges_linked: number;
}

export async function listSubscriptions(
  status?: SubscriptionStatus,
): Promise<Subscription[]> {
  const searchParams = status ? { status_filter: status } : undefined;
  return apiClient
    .get("api/v1/subscriptions", { searchParams })
    .json<Subscription[]>();
}

export async function createSubscription(
  data: SubscriptionCreate,
): Promise<Subscription> {
  return apiClient
    .post("api/v1/subscriptions", { json: data })
    .json<Subscription>();
}

export async function updateSubscription(
  id: string,
  data: SubscriptionUpdate,
): Promise<Subscription> {
  return apiClient
    .patch(`api/v1/subscriptions/${id}`, { json: data })
    .json<Subscription>();
}

export async function deleteSubscription(id: string): Promise<void> {
  await apiClient.delete(`api/v1/subscriptions/${id}`);
}

export async function confirmSubscription(id: string): Promise<Subscription> {
  return apiClient
    .post(`api/v1/subscriptions/${id}/confirm`)
    .json<Subscription>();
}

export async function dismissSubscription(id: string): Promise<Subscription> {
  return apiClient
    .post(`api/v1/subscriptions/${id}/dismiss`)
    .json<Subscription>();
}

export async function detectSubscriptions(): Promise<DetectionRunResult> {
  return apiClient
    .post("api/v1/subscriptions/detect")
    .json<DetectionRunResult>();
}

export async function listSubscriptionCharges(
  id: string,
): Promise<SubscriptionCharge[]> {
  return apiClient
    .get(`api/v1/subscriptions/${id}/charges`)
    .json<SubscriptionCharge[]>();
}
