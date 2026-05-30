import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStatements } from "./useStatements";
import { StatementCard } from "./StatementCard";
import type { StatementStatus } from "./statementsApi";

type FilterTab = "all" | "needs_review" | "failed";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_review", label: "Needs Review" },
  { value: "failed", label: "Failed" },
];

export const StatementsList = () => {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const statusFilter: StatementStatus | undefined =
    activeTab === "all" ? undefined : activeTab;

  const { data: statements, isLoading, isError } = useStatements(
    statusFilter ? { status: statusFilter } : undefined
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1" role="tablist" aria-label="Statement filters">
        {TABS.map((tab) => (
          <Button
            key={tab.value}
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={activeTab === tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "rounded-full px-4",
              activeTab === tab.value && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            )}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load statements.</p>
      ) : !statements || statements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No statements uploaded yet.</p>
      ) : (
        <ul className="space-y-3">
          {statements.map((statement) => (
            <li key={statement.id}>
              <StatementCard statement={statement} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
