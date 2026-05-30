import { cn } from "@/lib/utils";
import type { BankAccount } from "./bankAccountsApi";

interface BankAccountIconProps {
  account: BankAccount;
  className?: string;
}

export const BankAccountIcon = ({ account, className }: BankAccountIconProps) => {
  const bg = account.color ?? "#6b7280";
  const letter = account.institution.charAt(0).toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold leading-none",
        className
      )}
      style={{ backgroundColor: bg, color: getContrastColor(bg) }}
      aria-hidden="true"
    >
      {account.icon ? account.icon : letter}
    </span>
  );
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "#111827" : "#ffffff";
}
