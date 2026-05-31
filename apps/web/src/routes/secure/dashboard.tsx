import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Info,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Plus,
  DownloadCloud,
} from "lucide-react";

import { useAuthStore } from "@/stores/auth";
import { useTransactionsGlobal } from "@/features/transactions/useTransactions";
import type { Transaction } from "@/features/transactions/transactionsApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/secure/dashboard")({
  component: DashboardPage,
});

// ─── Date helpers (no date-fns) ───────────────────────────────────────────────

const now = new Date();
const y = now.getFullYear();
const m = now.getMonth() + 1;
const thisMonthStart = `${y}-${String(m).padStart(2, "0")}-01`;
const lastDay = new Date(y, m, 0).getDate();
const thisMonthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

const MONTH_LABEL = now.toLocaleDateString("en-US", { month: "long" });

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const sumAmounts = (items: Transaction[]) =>
  items.reduce((sum, t) => sum + parseFloat(t.amount), 0);

// ─── Avatar color map ─────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-pink-500",
];

const avatarColor = (name: string): string => {
  const code = (name.toUpperCase().charCodeAt(0) || 65) - 65;
  // AVATAR_COLORS always has 8 entries; modulo guarantees a valid index
  return AVATAR_COLORS[code % AVATAR_COLORS.length] as string;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  amount: string | null;
  loading: boolean;
  trend: "up" | "down" | "none";
  placeholder?: string;
}

const StatCard = ({ title, amount, loading, trend, placeholder }: StatCardProps) => (
  <Card className="flex-1 min-w-0">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {title}
        </div>
        <div className="flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {MONTH_LABEL}
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      {loading ? (
        <div className="h-8 w-32 animate-pulse bg-muted rounded" />
      ) : placeholder ? (
        <p className="text-2xl font-bold text-muted-foreground">{placeholder}</p>
      ) : (
        <p className="text-2xl font-bold tracking-tight">{amount}</p>
      )}
      <div className="flex items-center gap-1.5">
        {trend === "up" && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
          </span>
        )}
        {trend === "down" && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
            <TrendingDown className="h-3 w-3" aria-hidden="true" />
          </span>
        )}
        <span className="text-xs text-muted-foreground">This month</span>
      </div>
    </CardContent>
  </Card>
);

interface ActivityRowProps {
  transaction: Transaction;
}

const ActivityRow = ({ transaction: t }: ActivityRowProps) => {
  const isIncome = t.transaction_type === "income" || t.transaction_type === "refund";
  const merchantLabel = t.merchant_clean || t.merchant_raw || "?";
  // charAt always returns a string (empty string if out of bounds, but label is never empty)
  const initial = (merchantLabel.charAt(0) || "?").toUpperCase();
  const color = avatarColor(initial);
  const amount = parseFloat(t.amount);

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
          color,
        )}
        aria-hidden="true"
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">
          {t.merchant_clean || t.merchant_raw}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(t.date + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
        )}
      >
        {isIncome ? "+ " : "- "}
        {formatCurrency(Math.abs(amount))}
      </span>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const rawName = user?.email?.split("@")[0] ?? "there";
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  const expenseQuery = useTransactionsGlobal({
    date_from: thisMonthStart,
    date_to: thisMonthEnd,
    transaction_type: ["expense"],
    page_size: 500,
    sort_by: "date",
    sort_order: "desc",
  });

  const incomeQuery = useTransactionsGlobal({
    date_from: thisMonthStart,
    date_to: thisMonthEnd,
    transaction_type: ["income"],
    page_size: 500,
  });

  const recentQuery = useTransactionsGlobal({
    page_size: 8,
    sort_by: "date",
    sort_order: "desc",
  });

  const monthlySpent = expenseQuery.data
    ? formatCurrency(sumAmounts(expenseQuery.data.items))
    : null;

  const monthlyIncome = incomeQuery.data
    ? formatCurrency(sumAmounts(incomeQuery.data.items))
    : null;

  // Group recent transactions by date string
  const grouped = (recentQuery.data?.items ?? []).reduce<
    Record<string, Transaction[]>
  >((acc, t) => {
    const key = t.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const sortedDateKeys = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome Back, {displayName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here&apos;s what&apos;s happening with your finances.
          </p>
        </div>
        <Button
          variant="outline"
          disabled
          aria-label="Export report (coming soon)"
          className="shrink-0"
        >
          <DownloadCloud className="mr-2 h-4 w-4" aria-hidden="true" />
          Export Report
        </Button>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 flex-wrap sm:flex-nowrap">
        <StatCard
          title="Monthly Spent"
          amount={monthlySpent}
          loading={expenseQuery.isLoading}
          trend="down"
        />
        <StatCard
          title="Monthly Income"
          amount={monthlyIncome}
          loading={incomeQuery.isLoading}
          trend="up"
        />
        <StatCard
          title="My Balance"
          amount={null}
          loading={false}
          trend="none"
          placeholder="Coming soon"
        />
      </div>

      {/* Middle row */}
      <div className="flex gap-4 flex-wrap lg:flex-nowrap">
        {/* Cash Flow chart placeholder */}
        <Card className="flex-[3] min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle className="text-base font-semibold">Cash flow</CardTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-amber-400"
                      aria-hidden="true"
                    />
                    Expense
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-blue-500"
                      aria-hidden="true"
                    />
                    Income
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                {MONTH_LABEL}
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-52 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20">
              <p className="text-sm text-muted-foreground">Chart coming soon</p>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="flex-[2] min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                aria-label="Add new transaction"
              >
                <Link to="/secure/transactions">
                  <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Add new
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentQuery.isLoading && (
              <div className="space-y-3 py-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-muted shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            )}

            {!recentQuery.isLoading && sortedDateKeys.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No transactions yet.
              </p>
            )}

            {!recentQuery.isLoading &&
              sortedDateKeys.map((dateKey) => (
                <div key={dateKey}>
                  <p className="mb-1 mt-3 text-xs font-medium text-muted-foreground first:mt-0">
                    {new Date(dateKey + "T00:00:00").toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <div className="divide-y divide-border/50">
                    {(grouped[dateKey] ?? []).map((t) => (
                      <ActivityRow key={t.id} transaction={t} />
                    ))}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
