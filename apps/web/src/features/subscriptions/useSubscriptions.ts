import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  confirmSubscription,
  dismissSubscription,
  detectSubscriptions,
  listSubscriptionCharges,
  type SubscriptionCreate,
  type SubscriptionUpdate,
  type SubscriptionStatus,
} from "./subscriptionsApi";

export const subscriptionKeys = {
  all: ["subscriptions"] as const,
  list: (status?: SubscriptionStatus) =>
    [...subscriptionKeys.all, { status }] as const,
  charges: (id: string) => [...subscriptionKeys.all, id, "charges"] as const,
};

export function useSubscriptions(status?: SubscriptionStatus) {
  return useQuery({
    queryKey: subscriptionKeys.list(status),
    queryFn: () => listSubscriptions(status),
  });
}

export function useSubscriptionCharges(id: string | null) {
  return useQuery({
    queryKey: subscriptionKeys.charges(id ?? ""),
    queryFn: () => listSubscriptionCharges(id as string),
    enabled: !!id,
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SubscriptionCreate) => createSubscription(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubscriptionUpdate }) =>
      updateSubscription(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSubscription(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

export function useConfirmSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => confirmSubscription(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

export function useDismissSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dismissSubscription(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

export function useDetectSubscriptions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => detectSubscriptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}
