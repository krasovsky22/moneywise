import { useState, useEffect, useRef } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { StatementStatusBadge } from "./StatementStatusBadge";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { useStatementStatus, useReprocessStatement, statementKeys } from "./useStatements";
import type { Statement, StatementStatus } from "./statementsApi";

const ACTIVE_STATUSES = new Set<StatementStatus>(["queued", "parsing", "categorizing"]);

const FAILURE_REASON_LABELS: Record<string, string> = {
  unreadable_pdf: "Unreadable PDF",
  encrypted: "Encrypted file",
  unsupported_format: "Unsupported format",
  parsing_error: "Parsing error",
  ai_unavailable: "AI service unavailable",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface StatementCardProps {
  statement: Statement;
  accountLabel?: string;
}

const PollingUpdater = ({ id }: { id: string }) => {
  const queryClient = useQueryClient();
  const { data } = useStatementStatus(id, true);
  const prevStatusRef = useRef<StatementStatus | undefined>(undefined);

  useEffect(() => {
    if (!data) return;
    if (prevStatusRef.current !== undefined && prevStatusRef.current !== data.status) {
      void queryClient.invalidateQueries({ queryKey: statementKeys.all });
    }
    prevStatusRef.current = data.status;
  }, [data, queryClient]);

  return null;
};

export const StatementCard = ({ statement, accountLabel }: StatementCardProps) => {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const reprocess = useReprocessStatement();
  const isActive = ACTIVE_STATUSES.has(statement.status);

  const accountDisplay =
    accountLabel ??
    (statement.card_id ? "Card" : statement.bank_account_id ? "Bank Account" : "Unknown");

  return (
    <>
      {isActive && <PollingUpdater id={statement.id} />}

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{statement.file_original_name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {accountDisplay}
              <span className="mx-1.5">·</span>
              {formatBytes(statement.file_size_bytes)}
              <span className="mx-1.5">·</span>
              {formatDate(statement.uploaded_at)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatementStatusBadge status={statement.status} />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${statement.file_original_name}`}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {statement.status === "needs_review" && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Action needed — review this statement</span>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0 text-xs">
              <Link to="/secure/statements/$statementId" params={{ statementId: statement.id }}>
                Review →
              </Link>
            </Button>
          </div>
        )}

        {statement.status === "ready" && (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link to="/secure/statements/$statementId" params={{ statementId: statement.id }}>
                View →
              </Link>
            </Button>
          </div>
        )}

        {statement.status === "failed" && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-destructive">
              {statement.failure_reason
                ? FAILURE_REASON_LABELS[statement.failure_reason] ?? statement.failure_reason
                : "Processing failed"}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={reprocess.isPending}
              onClick={() => reprocess.mutate(statement.id)}
              aria-label={`Retry processing ${statement.file_original_name}`}
            >
              {reprocess.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Retry
            </Button>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        statementId={statement.id}
        fileName={statement.file_original_name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
};
