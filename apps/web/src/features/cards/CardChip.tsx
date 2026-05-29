import { cn } from "@/lib/utils";
import type { Card } from "./cardsApi";

interface CardChipProps {
  card: Card;
  className?: string;
}

export const CardChip = ({ card, className }: CardChipProps) => {
  const bg = card.color ?? "#6b7280";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        className
      )}
      style={{ backgroundColor: bg, color: getContrastColor(bg) }}
    >
      {card.icon ? (
        <span aria-hidden="true">{card.icon}</span>
      ) : null}
      <span aria-hidden="true">••••</span>
      <span>{card.last4}</span>
      <span>—</span>
      <span>{card.nickname}</span>
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
  // Perceived luminance formula
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "#111827" : "#ffffff";
}
