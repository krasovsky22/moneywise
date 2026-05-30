import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatementStatus } from "./statementsApi";

interface StatementStatusBadgeProps {
  status: StatementStatus;
}

const STATUS_CONFIG: Record<
  StatementStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  queued: { label: "Queued", variant: "secondary" },
  parsing: { label: "Parsing…", variant: "default" },
  categorizing: { label: "Categorizing…", variant: "default" },
  needs_review: {
    label: "Needs Review",
    variant: "outline",
    className: "border-yellow-400 text-yellow-700 dark:text-yellow-400",
  },
  ready: {
    label: "Ready",
    variant: "outline",
    className: "border-green-500 text-green-700 dark:text-green-400",
  },
  failed: { label: "Failed", variant: "destructive" },
};

export const StatementStatusBadge = ({ status }: StatementStatusBadgeProps) => {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={cn(config.className)}>
      {config.label}
    </Badge>
  );
};
