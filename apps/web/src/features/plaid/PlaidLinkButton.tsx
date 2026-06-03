import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { plaidApi } from "./plaidApi";
import { PLAID_ITEMS_KEY } from "./usePlaid";

interface PlaidLinkButtonProps {
  mode?: "connect" | "reconnect";
  itemId?: string;
  onSuccess?: () => void;
}

export const PlaidLinkButton = ({
  mode = "connect",
  itemId,
  onSuccess,
}: PlaidLinkButtonProps) => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: async (publicToken, metadata) => {
      if (mode === "reconnect") {
        qc.invalidateQueries({ queryKey: PLAID_ITEMS_KEY });
        toast.success("Account reconnected successfully");
        onSuccess?.();
        return;
      }
      try {
        const item = await plaidApi.exchangeToken({
          public_token: publicToken,
          institution_id: metadata.institution?.institution_id ?? "",
          institution_name: metadata.institution?.name ?? "",
        });
        toast.info("Account connected! Syncing transactions…");
        const result = await plaidApi.syncItem(item.id);
        qc.invalidateQueries({ queryKey: PLAID_ITEMS_KEY });
        qc.invalidateQueries({ queryKey: ["transactions"] });
        const parts: string[] = [];
        if (result.added) parts.push(`${result.added} added`);
        if (result.modified) parts.push(`${result.modified} updated`);
        if (result.removed) parts.push(`${result.removed} removed`);
        toast.success(parts.length ? `Synced: ${parts.join(", ")}` : "Account connected — no transactions yet");
        onSuccess?.();
      } catch {
        toast.error("Failed to connect account");
      }
    },
    onExit: (err) => {
      if (err) toast.error("Connection cancelled");
      setToken(null);
    },
  });

  useEffect(() => {
    if (token && ready) {
      open();
    }
  }, [token, ready, open]);

  const handleClick = async () => {
    setLoading(true);
    try {
      const resp =
        mode === "reconnect" && itemId
          ? await plaidApi.getUpdateModeLinkToken(itemId)
          : await plaidApi.getLinkToken();
      setToken(resp.link_token);
    } catch {
      toast.error("Failed to initialize connection");
    } finally {
      setLoading(false);
    }
  };

  if (mode === "reconnect") {
    return (
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        Reconnect
      </Button>
    );
  }

  return (
    <Button onClick={handleClick} disabled={loading} className="gap-2">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      Connect a bank
    </Button>
  );
};
