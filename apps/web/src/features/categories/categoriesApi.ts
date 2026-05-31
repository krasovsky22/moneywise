import { apiClient } from "@/lib/api-client";

export interface Category {
  id: string;
  household_id: string | null;
  parent_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  kind: "spending" | "income" | "transfer";
  created_at: string;
  children: Category[];
}

export interface CategoryRule {
  id: string;
  household_id: string;
  pattern: string;
  match_type: string;
  category_id: string;
  created_by_user_id: string | null;
  created_at: string;
  hit_count: number;
  last_applied_at: string | null;
}

export interface CategoryRuleCreate {
  pattern: string;
  category_id: string;
  match_type?: string;
}

export interface CategoryCreate {
  name: string;
  parent_id?: string | null;
  icon?: string | null;
  color?: string | null;
  kind?: "spending" | "income" | "transfer";
}

export async function listCategories(): Promise<Category[]> {
  return apiClient.get("api/v1/categories").json<Category[]>();
}

export async function createCategory(body: CategoryCreate): Promise<Category> {
  return apiClient.post("api/v1/categories", { json: body }).json<Category>();
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`api/v1/categories/${id}`);
}

export async function listRules(): Promise<CategoryRule[]> {
  return apiClient.get("api/v1/categories/rules").json<CategoryRule[]>();
}

export async function createRule(
  body: CategoryRuleCreate,
): Promise<CategoryRule> {
  return apiClient
    .post("api/v1/categories/rules", { json: body })
    .json<CategoryRule>();
}

export async function deleteRule(id: string): Promise<void> {
  await apiClient.delete(`api/v1/categories/rules/${id}`);
}
