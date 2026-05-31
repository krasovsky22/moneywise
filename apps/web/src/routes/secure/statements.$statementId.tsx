import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useStatement, useStatementStatus, useReprocessStatement, statementKeys } from "@/features/statements/useStatements";
import { StatementReview } from "@/features/statements/StatementReview";
import { StatementStatusBadge } from "@/features/statements/StatementStatusBadge";
import type { StatementStatus } from "@/features/statements/statementsApi";

export const Route = createFileRoute("/secure/statements/$statementId")({
  component: StatementDetailPage,
});

const ACTIVE_STATUSES = new Set<StatementStatus>(["queued", "parsing", "categorizing"]);

const PollingUpdater = ({ id }: { id: string }) => {
  const queryClient = useQueryClient();
  const { data } = useStatementStatus(id, true);
  const prevRef = useRef<StatementStatus | undefined>(undefined);

  useEffect(() => {
    if (!data) return;
    if (prevRef.current !== undefined && prevRef.current !== data.status) {
      void queryClient.invalidateQueries({ queryKey: statementKeys.detail(id) });
    }
    prevRef.current = data.status;
  }, [data, id, queryClient]);

  return null;
};

function StatementDetailPage() {
  const { statementId } = Route.useParams();
  const { data: statement, isLoading } = useStatement(statementId);
  const reprocess = useReprocessStatement();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground text-sm">
        Statement not found.
      </div>
    );
  }

  const isProcessing = ACTIVE_STATUSES.has(statement.status);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      {isProcessing && <PollingUpdater id={statementId} />}

      <div className="flex items-center gap-3">
        <Link
          to="/secure/statements"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to statements"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="flex-1 min-w-0">
          <h1 className="truncate text-2xl font-bold">{statement.file_original_name}</h1>
          <p className="text-sm text-muted-foreground">
            {statement.period_start && statement.period_end
              ? `${statement.period_start} – ${statement.period_end}`
              : "Period not detected"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StatementStatusBadge status={statement.status} />
          <Button
            variant="outline"
            size="sm"
            disabled={reprocess.isPending || isProcessing}
            onClick={() => reprocess.mutate(statementId)}
            aria-label="Reprocess statement"
          >
            {reprocess.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            Reprocess
          </Button>
        </div>
      </div>

      {(statement.status === "needs_review" || statement.status === "ready") && (
        <StatementReview statementId={statementId} />
      )}

      {isProcessing && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Processing statement…
        </div>
      )}

      {statement.status === "failed" && (
        <div className="py-12 text-center text-sm text-destructive">
          Processing failed: {statement.failure_reason ?? "unknown error"}
        </div>
      )}
    </div>
  );
}
