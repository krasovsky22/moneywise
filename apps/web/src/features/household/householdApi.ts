import { apiClient } from "@/lib/api-client";

export interface Household {
  id: string;
  name: string;
  is_plaid_sandbox: boolean;
  created_at: string;
}

export interface HouseholdMember {
  user_id: string;
  email: string;
  display_name: string | null;
  joined_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  created_at: string;
  invite_url: string;
}

export async function getHousehold(): Promise<Household> {
  return apiClient.get("api/v1/household").json<Household>();
}

export async function updateHouseholdName(name: string): Promise<Household> {
  return apiClient
    .patch("api/v1/household", { json: { name } })
    .json<Household>();
}

export async function updateHouseholdSandbox(isSandbox: boolean): Promise<Household> {
  return apiClient
    .patch("api/v1/household", { json: { is_plaid_sandbox: isSandbox } })
    .json<Household>();
}

export async function getMembers(): Promise<HouseholdMember[]> {
  return apiClient.get("api/v1/household/members").json<HouseholdMember[]>();
}

export async function createInvitation(email: string): Promise<Invitation> {
  return apiClient
    .post("api/v1/household/invitations", { json: { email } })
    .json<Invitation>();
}

export async function getInvitations(): Promise<Invitation[]> {
  return apiClient
    .get("api/v1/household/invitations")
    .json<Invitation[]>();
}

export async function revokeInvitation(id: string): Promise<void> {
  await apiClient.delete(`api/v1/household/invitations/${id}`);
}

export async function acceptInvitation(token: string): Promise<Household> {
  return apiClient
    .post("api/v1/household/accept-invitation", { json: { token } })
    .json<Household>();
}

export async function leaveHousehold(): Promise<Household> {
  return apiClient.post("api/v1/household/leave").json<Household>();
}
