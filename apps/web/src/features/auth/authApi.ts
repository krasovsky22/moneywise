import { apiClient } from "@/lib/api-client";

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export async function login(
  email: string,
  password: string
): Promise<TokenResponse> {
  return apiClient
    .post("api/v1/auth/login", { json: { email, password } })
    .json<TokenResponse>();
}

export async function register(
  email: string,
  password: string
): Promise<TokenResponse> {
  return apiClient
    .post("api/v1/auth/register", { json: { email, password } })
    .json<TokenResponse>();
}

export async function logout(): Promise<void> {
  await apiClient.post("api/v1/auth/logout");
}

export async function refresh(): Promise<TokenResponse> {
  return apiClient
    .post("api/v1/auth/refresh")
    .json<TokenResponse>();
}

export async function getMe(): Promise<User> {
  return apiClient.get("api/v1/users/me").json<User>();
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiClient.post("api/v1/auth/change-password", {
    json: { current_password: currentPassword, new_password: newPassword },
  });
}
