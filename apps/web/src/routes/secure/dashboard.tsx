import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Info,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Plus,
  DownloadCloud,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useAuthStore } from "@/stores/auth";
import {
  useTransactionsGlobal,
  useTransactionsSummary,
} from "@/features/transactions/useTransactions";
import { useCards } from "@/features/cards/useCards";
import type {
  MonthSummary,
  Transaction,
} from "@/features/transactions/transactionsApi";
import type { Card as CardType } from "@/features/cards/cardsApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/secure/dashboard")({
  component: DashboardPage,
});

// ─── Month helpers ────────────────────────────────────────────────────────────

interface MonthOption {
  value: string; // "YYYY-MM"
  label: string; // "May 2026"
}

function buildMonthOptions(): MonthOption[] {
  const options: MonthOption[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mo = d.getMonth() + 1;
    options.push({
      value: `${d.getFullYear()}-${String(mo).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    });
  }
  return options;
}

function getMonthDateRange(yearMonth: string): {
  date_from: string;
  date_to: string;
} {
  const [y, mo] = yearMonth.split("-").map(Number);
  const lastDay = new Date(y!, mo!, 0).getDate();
  return {
    date_from: `${yearMonth}-01`,
    date_to: `${yearMonth}-${String(lastDay).padStart(2, "0")}`,
  };
}

const MONTH_OPTIONS = buildMonthOptions();
const CURRENT_MONTH = MONTH_OPTIONS[0]!.value;
const CURRENT_MONTH_LABEL = new Date().toLocaleDateString("en-US", {
  month: "long",
});

// One summary window covering every selectable month (13 back) in one query.
const SUMMARY_RANGE = {
  date_from: `${MONTH_OPTIONS[MONTH_OPTIONS.length - 1]!.value}-01`,
  date_to: getMonthDateRange(CURRENT_MONTH).date_to,
};

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const formatYAxis = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
};

// ─── Chart helpers ────────────────────────────────────────────────────────────

interface ChartPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}

function buildChartData(months: MonthSummary[]): ChartPoint[] {
  return months.slice(-6).map((m) => {
    const [y, mo] = m.month.split("-").map(Number);
    return {
      month: new Date(y!, mo! - 1, 1).toLocaleDateString("en-US", {
        month: "short",
      }),
      income: parseFloat(m.income),
      expense: parseFloat(m.expense),
      net: parseFloat(m.net),
    };
  });
}

// ─── Cash Flow tooltip ────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
}

interface CashFlowTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CashFlowTooltip({ active, payload, label }: CashFlowTooltipProps) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.dataKey === "income")?.value ?? 0;
  const expense = payload.find((p) => p.dataKey === "expense")?.value ?? 0;
  const net = payload.find((p) => p.dataKey === "net")?.value ?? 0;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg text-xs">
      <p className="font-semibold mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            Income
          </span>
          <span className="font-medium text-emerald-600 tabular-nums">
            {formatCurrency(income)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            Expense
          </span>
          <span className="font-medium text-rose-600 tabular-nums">
            {formatCurrency(expense)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6 border-t pt-1 mt-1">
          <span className="text-muted-foreground">Net</span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              net >= 0 ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {net >= 0 ? "+" : ""}
            {formatCurrency(net)}
          </span>
        </div>
      </div>
    </div>
  );
}

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
  return AVATAR_COLORS[code % AVATAR_COLORS.length] as string;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  amount: string | null;
  loading: boolean;
  trend: "up" | "down" | "none";
  placeholder?: string;
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
}

const StatCard = ({
  title,
  amount,
  loading,
  trend,
  placeholder,
  selectedMonth,
  onMonthChange,
}: StatCardProps) => {
  const monthLabel =
    selectedMonth === CURRENT_MONTH
      ? "This month"
      : (MONTH_OPTIONS.find((o) => o.value === selectedMonth)?.label ??
        CURRENT_MONTH_LABEL);

  return (
    <Card className="flex-1 min-w-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {title}
          </div>
          {selectedMonth && onMonthChange ? (
            <Select value={selectedMonth} onValueChange={onMonthChange}>
              <SelectTrigger className="h-auto w-auto rounded-full border bg-transparent px-2 py-0.5 text-xs text-muted-foreground gap-0.5 shadow-none focus:ring-0 focus:ring-offset-0 [&_svg]:h-3 [&_svg]:w-3 [&_svg]:opacity-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {MONTH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              {CURRENT_MONTH_LABEL}
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="h-8 w-32 animate-pulse bg-muted rounded" />
        ) : placeholder ? (
          <p className="text-2xl font-bold text-muted-foreground">
            {placeholder}
          </p>
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
          <span className="text-xs text-muted-foreground">{monthLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
};

interface ActivityRowProps {
  transaction: Transaction;
  cardMap: Map<string, CardType>;
}

const ActivityRow = ({ transaction: t, cardMap }: ActivityRowProps) => {
  const isIncome =
    t.transaction_type === "income" || t.transaction_type === "refund";
  const merchantLabel = t.merchant_clean || t.merchant_raw || "?";
  const initial = (merchantLabel.charAt(0) || "?").toUpperCase();
  const color = avatarColor(initial);
  const amount = parseFloat(t.amount);
  const card = t.card_id ? cardMap.get(t.card_id) : null;

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
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-xs text-muted-foreground">
            {new Date(t.date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
          {card && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
              style={{
                backgroundColor: card.color ?? "#6b7280",
                color: getContrastColor(card.color ?? "#6b7280"),
              }}
            >
              {card.icon && <span aria-hidden="true">{card.icon}</span>}
              <span>••{card.last4}</span>
            </span>
          )}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          isIncome
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400",
        )}
      >
        {isIncome ? "+ " : "- "}
        {formatCurrency(Math.abs(amount))}
      </span>
    </div>
  );
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "#111827" : "#ffffff";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ACTIVITY_PAGE_SIZE = 10;

function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [expenseMonth, setExpenseMonth] = useState(CURRENT_MONTH);
  const [incomeMonth, setIncomeMonth] = useState(CURRENT_MONTH);
  const [balanceMonth, setBalanceMonth] = useState(CURRENT_MONTH);
  const [activityPage, setActivityPage] = useState(1);
  const [selectedCardId, setSelectedCardId] = useState<string>("all");

  const rawName = user?.email?.split("@")[0] ?? "there";
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  const currentMonthRange = getMonthDateRange(CURRENT_MONTH);

  const cardsQuery = useCards();
  const cards = cardsQuery.data ?? [];
  const cardMap = new Map<string, CardType>(cards.map((c) => [c.id, c]));

  function handleCardChange(value: string) {
    setSelectedCardId(value);
    setActivityPage(1);
  }

  // Single server-side aggregation covers stat cards + cash-flow chart.
  const summaryQuery = useTransactionsSummary(
    SUMMARY_RANGE.date_from,
    SUMMARY_RANGE.date_to,
  );

  const monthMap = useMemo(
    () =>
      new Map<string, MonthSummary>(
        (summaryQuery.data?.months ?? []).map((m) => [m.month, m]),
      ),
    [summaryQuery.data],
  );

  const recentQuery = useTransactionsGlobal({
    date_from: currentMonthRange.date_from,
    date_to: currentMonthRange.date_to,
    page: activityPage,
    page_size: ACTIVITY_PAGE_SIZE,
    sort_by: "date",
    sort_order: "desc",
    ...(selectedCardId !== "all" ? { card_ids: [selectedCardId] } : {}),
  });

  const chartData = useMemo<ChartPoint[] | null>(() => {
    if (!summaryQuery.data) return null;
    return buildChartData(summaryQuery.data.months);
  }, [summaryQuery.data]);

  const totalActivityPages = recentQuery.data?.total_pages ?? 1;

  const summaryLoading = summaryQuery.isLoading;

  const monthlySpent = summaryQuery.data
    ? formatCurrency(parseFloat(monthMap.get(expenseMonth)?.expense ?? "0"))
    : null;

  const monthlyIncome = summaryQuery.data
    ? formatCurrency(parseFloat(monthMap.get(incomeMonth)?.income ?? "0"))
    : null;

  const balanceValue = summaryQuery.data
    ? parseFloat(monthMap.get(balanceMonth)?.net ?? "0")
    : null;
  const balanceFormatted =
    balanceValue !== null ? formatCurrency(balanceValue) : null;
  const balanceTrend: "up" | "down" | "none" =
    balanceValue === null ? "none" : balanceValue >= 0 ? "up" : "down";

  const grouped = (recentQuery.data?.items ?? []).reduce<
    Record<string, Transaction[]>
  >((acc, t) => {
    const key = t.date;
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(t);
    return acc;
  }, {});

  const sortedDateKeys = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  const chartLoading = summaryLoading;

  return (
    <main className="w-full px-6 py-8 space-y-8">
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
          loading={summaryLoading}
          trend="down"
          selectedMonth={expenseMonth}
          onMonthChange={setExpenseMonth}
        />
        <StatCard
          title="Monthly Income"
          amount={monthlyIncome}
          loading={summaryLoading}
          trend="up"
          selectedMonth={incomeMonth}
          onMonthChange={setIncomeMonth}
        />
        <StatCard
          title="My Balance"
          amount={balanceFormatted}
          loading={summaryLoading}
          trend={balanceTrend}
          selectedMonth={balanceMonth}
          onMonthChange={setBalanceMonth}
        />
      </div>

      {/* Middle row */}
      <div className="flex gap-4 flex-wrap lg:flex-nowrap">
        {/* Cash Flow chart */}
        <Card className="flex-[4] min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle className="text-base font-semibold">
                  Cash flow
                </CardTitle>
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
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-violet-500"
                      aria-hidden="true"
                    />
                    Net
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                Last 6 months
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="flex h-52 items-end justify-between gap-3 px-4 pb-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col gap-1 items-center">
                    <div
                      className="w-full animate-pulse rounded bg-muted"
                      style={{ height: `${40 + Math.random() * 80}px` }}
                    />
                    <div className="h-2 w-6 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={208}>
                <ComposedChart
                  data={chartData ?? []}
                  margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                  barCategoryGap="30%"
                  barGap={3}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="currentColor"
                    strokeOpacity={0.08}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
                    dy={6}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
                    tickFormatter={formatYAxis}
                    width={44}
                  />
                  <Tooltip
                    content={<CashFlowTooltip />}
                    cursor={{ fill: "currentColor", fillOpacity: 0.04 }}
                  />
                  <Bar
                    dataKey="income"
                    fill="#3b82f6"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="expense"
                    fill="#fbbf24"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="flex-[1] min-w-0 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base font-semibold shrink-0">
                Recent Activity
              </CardTitle>
              <div className="flex items-center gap-1.5 min-w-0">
                {cards.length > 0 && (
                  <Select
                    value={selectedCardId}
                    onValueChange={handleCardChange}
                  >
                    <SelectTrigger className="h-7 w-auto max-w-[130px] text-xs px-2">
                      <SelectValue placeholder="All cards" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All cards</SelectItem>
                      {cards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          ••{c.last4} — {c.nickname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  aria-label="Add new transaction"
                >
                  <Link to="/secure/transactions">
                    <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Add new
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col flex-1">
            <div className="flex-1">
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
                  No transactions this month.
                </p>
              )}

              {!recentQuery.isLoading &&
                sortedDateKeys.map((dateKey) => (
                  <div key={dateKey}>
                    <p className="mb-1 mt-3 text-xs font-medium text-muted-foreground first:mt-0">
                      {new Date(dateKey + "T00:00:00").toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </p>
                    <div className="divide-y divide-border/50">
                      {(grouped[dateKey] ?? []).map((t) => (
                        <ActivityRow
                          key={t.id}
                          transaction={t}
                          cardMap={cardMap}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            {/* Pagination */}
            {!recentQuery.isLoading && totalActivityPages > 1 && (
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={activityPage <= 1}
                  onClick={() => setActivityPage((p) => p - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {activityPage} / {totalActivityPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={activityPage >= totalActivityPages}
                  onClick={() => setActivityPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
