import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { usePlaidItems } from "./usePlaid";
import { PlaidItemCard } from "./PlaidItemCard";
import { PlaidLinkButton } from "./PlaidLinkButton";

export const ConnectedAccountsSection = () => {
  const { data: items = [], isLoading } = usePlaidItems();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Building2 className="h-5 w-5" />
          Connected Banks
        </h2>
        {items.length > 0 && <PlaidLinkButton />}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-muted-foreground">No banks connected yet.</p>
            <p className="text-sm text-muted-foreground">
              Connect your bank to automatically sync transactions.
            </p>
            <PlaidLinkButton />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <PlaidItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};
