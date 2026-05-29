import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCards,
  getCard,
  createCard,
  updateCard,
  archiveCard,
  unarchiveCard,
  type CardCreate,
} from "./cardsApi";

export const cardKeys = {
  all: ["cards"] as const,
  list: (includeArchived?: boolean) =>
    [...cardKeys.all, { includeArchived }] as const,
  detail: (cardId: string) => [...cardKeys.all, cardId] as const,
};

export function useCards(includeArchived?: boolean) {
  return useQuery({
    queryKey: cardKeys.list(includeArchived),
    queryFn: () => listCards(includeArchived),
  });
}

export function useCard(cardId: string) {
  return useQuery({
    queryKey: cardKeys.detail(cardId),
    queryFn: () => getCard(cardId),
    enabled: !!cardId,
  });
}

export function useCreateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CardCreate) => createCard(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.all });
    },
  });
}

export function useUpdateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: Partial<CardCreate> }) =>
      updateCard(cardId, data),
    onSuccess: (_result, { cardId }) => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.all });
      void queryClient.invalidateQueries({ queryKey: cardKeys.detail(cardId) });
    },
  });
}

export function useArchiveCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => archiveCard(cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.all });
    },
  });
}

export function useUnarchiveCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => unarchiveCard(cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardKeys.all });
    },
  });
}
