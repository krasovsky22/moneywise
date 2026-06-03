import { useState } from "react";
import { Info, ExternalLink, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PlaidRawMetadata } from "./transactionsApi";

interface MerchantCellProps {
  merchantName: string;
  plaidMetadata?: PlaidRawMetadata | null;
  isDeleted?: boolean;
  isPending?: boolean;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCategory(primary: string, detailed: string): string {
  const formattedPrimary = toTitleCase(primary);
  const suffix = toTitleCase(detailed.replace(new RegExp(`^${primary}_?`, "i"), ""));
  return suffix ? `${formattedPrimary} › ${suffix}` : formattedPrimary;
}

interface LogoAvatarProps {
  url: string | null | undefined;
  name: string;
  size: number;
}

const LogoAvatar = ({ url, name, size }: LogoAvatarProps) => {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === 40 ? "h-10 w-10 text-sm" : "h-6 w-6 text-[10px]";

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={cn("rounded-full object-contain shrink-0 bg-muted", sizeClass)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-muted flex items-center justify-center font-medium text-muted-foreground shrink-0 uppercase",
        sizeClass,
      )}
      aria-hidden="true"
    >
      {name.charAt(0)}
    </div>
  );
};

const PlaidInfoPopover = ({
  merchantName,
  metadata,
}: {
  merchantName: string;
  metadata: PlaidRawMetadata;
}) => {
  const displayName = metadata.merchant_name ?? metadata.name ?? merchantName;
  const category = metadata.personal_finance_category;
  const counterparties = metadata.counterparties?.filter((cp) => cp.name) ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="View Plaid transaction details"
        >
          <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-3 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: logo + name */}
        <div className="flex items-center gap-2">
          <LogoAvatar url={metadata.logo_url} name={displayName} size={40} />
          <span className="font-semibold text-sm leading-tight">{displayName}</span>
        </div>

        {/* Website */}
        {metadata.website && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3 shrink-0" />
            <a
              href={`https://${metadata.website.replace(/^https?:\/\//, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline text-foreground truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {metadata.website}
            </a>
          </div>
        )}

        {/* Payment channel */}
        {metadata.payment_channel && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CreditCard className="h-3 w-3 shrink-0" />
            <span>{toTitleCase(metadata.payment_channel)}</span>
          </div>
        )}

        {/* Category */}
        {category && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Category
            </p>
            <div className="flex items-center gap-1.5">
              {metadata.personal_finance_category_icon_url && (
                <img
                  src={metadata.personal_finance_category_icon_url}
                  alt=""
                  width={16}
                  height={16}
                  className="shrink-0"
                />
              )}
              <span className="text-xs">
                {formatCategory(category.primary, category.detailed)}
              </span>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {toTitleCase(category.confidence_level)}
            </Badge>
          </div>
        )}

        {/* Counterparties */}
        {counterparties.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Counterparties
            </p>
            {counterparties.map((cp, i) => (
              <div key={cp.entity_id ?? i} className="flex items-center gap-2">
                <LogoAvatar url={cp.logo_url} name={cp.name} size={24} />
                <div className="min-w-0">
                  <p className="text-xs truncate">{cp.name}</p>
                  {cp.type && (
                    <p className="text-[10px] text-muted-foreground capitalize">{cp.type}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export const MerchantCell = ({
  merchantName,
  plaidMetadata,
  isDeleted,
  isPending,
}: MerchantCellProps) => {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <LogoAvatar url={plaidMetadata?.logo_url} name={merchantName} size={24} />
      <span
        className={cn(
          "truncate text-sm font-medium",
          isDeleted && "line-through text-muted-foreground",
          isPending && "italic text-muted-foreground",
        )}
      >
        {merchantName}
      </span>
      {plaidMetadata && (
        <PlaidInfoPopover merchantName={merchantName} metadata={plaidMetadata} />
      )}
    </div>
  );
};
