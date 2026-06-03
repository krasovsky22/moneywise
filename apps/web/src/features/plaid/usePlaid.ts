import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { plaidApi } from "./plaidApi";

export const PLAID_ITEMS_KEY = ["plaid-items"] as const;

export function usePlaidItems() {
  return useQuery({ queryKey: PLAID_ITEMS_KEY, queryFn: plaidApi.listItems });
}

export function useDisconnectItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plaidApi.deleteItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLAID_ITEMS_KEY });
      toast.success("Institution disconnected");
    },
    onError: () => toast.error("Failed to disconnect institution"),
  });
}

export function useSyncItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plaidApi.syncItem(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: PLAID_ITEMS_KEY });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      const { added, modified, removed } = result;
      const parts: string[] = [];
      if (added) parts.push(`${added} added`);
      if (modified) parts.push(`${modified} updated`);
      if (removed) parts.push(`${removed} removed`);
      toast.success(parts.length ? `Synced: ${parts.join(", ")}` : "Already up to date");
    },
    onError: () => toast.error("Failed to sync"),
  });
}
