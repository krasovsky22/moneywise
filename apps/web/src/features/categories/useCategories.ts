import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCategories,
  listRules,
  createRule,
  deleteRule,
  createCategory,
  deleteCategory,
  type CategoryRuleCreate,
  type CategoryCreate,
} from "./categoriesApi";

export const categoryKeys = {
  all: ["categories"] as const,
  list: () => [...categoryKeys.all, "list"] as const,
  rules: () => [...categoryKeys.all, "rules"] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: listCategories,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategoryRules() {
  return useQuery({
    queryKey: categoryKeys.rules(),
    queryFn: listRules,
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryRuleCreate) => createRule(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.rules() });
    },
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.rules() });
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryCreate) => createCategory(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}
