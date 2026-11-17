"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IconDownload } from "@/components/Icons";
import { AppShell, SurfaceCard } from "@/components/AppShell";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartSkeleton } from "@/components/ui/Skeleton";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { currentMonthKey } from "@/lib/expenses";
import { formatMoney } from "@/lib/money";

type CategorySlice = {
  categoryId: string;
  category: string;
  total: number;
  percentage: number;
  previousTotal: number;
  changePercent: number | null;
};

type MonthBar = {
  month: string;
  income: number;
  expenses: number;
};

type DailyPoint = {
  date: string;
  total: number;
};

type TopExpense = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  originalAmount?: number;
  currency?: string;
};

type SavingsSummary = {
  income: number;
  expenses: number;
  rate: number | null;
};

type ReportsPayload = {
  month: string;
  baseCurrency?: string;
  byCategory: CategorySlice[];
  byMonth: MonthBar[];
  dailySpending: DailyPoint[];
  savings: SavingsSummary;
  topExpenses: TopExpense[];
};

const PIE_COLORS = [
  "#0f766e",
  "#059669",
  "#10b981",
  "#ef4444",
  "#f59e0b",
  "#14b8a6",
  "#047857",
];

const CHART_GRID = "rgba(148, 163, 184, 0.35)";
const CHART_INCOME = "#059669";
const CHART_EXPENSE = "#ef4444";
const CHART_PRIMARY = "#0f766e";

function formatMonthLabel(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return "…";
  const [year, mon] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, mon - 1, 1));
}

function formatMonthLabelLong(monthKey: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return "…";
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatDayLabel(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const day = Number(date.slice(8, 10));
  return String(day);
}

function categoryComparisonText(slice: CategorySlice): string | null {
  if (slice.changePercent === null) {
    return `${slice.category} is new compared to last month`;
  }
  if (slice.changePercent === 0) {
    if (slice.total === 0 && slice.previousTotal === 0) return null;
    return `${slice.category} is unchanged from last month`;
  }
  const abs = Math.abs(slice.changePercent);
  const direction = slice.changePercent > 0 ? "higher" : "lower";
  return `${slice.category} is ${abs}% ${direction} than last month`;
}

export function ReportsClient() {
  // Defer calendar reads until mount — Cache Components forbids `new Date()` in prerender.
  const [month, setMonth] = useState("");
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!month) {
      // Defer so setState is not synchronous in the effect body.
      void Promise.resolve().then(() => setMonth(currentMonthKey()));
      return;
    }

    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/reports?month=${encodeURIComponent(month)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Failed to load reports");
        }
        const payload = (await res.json()) as ReportsPayload;
        setData(payload);
      } catch (err) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(err instanceof Error ? err.message : "Failed to load reports");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    // Defer so setState inside load is not synchronous in the effect body.
    void Promise.resolve().then(() => load());
    return () => controller.abort();
  }, [month]);

  const baseCurrency = data?.baseCurrency || DEFAULT_BASE_CURRENCY;

  const pieData =
    data?.byCategory.map((slice) => ({
      name: slice.category,
      value: slice.total,
    })) ?? [];

  const barData =
    data?.byMonth.map((row) => ({
      month: formatMonthLabel(row.month),
      income: row.income / 100,
      expenses: row.expenses / 100,
      incomeMinor: row.income,
      expensesMinor: row.expenses,
    })) ?? [];

  const lineData =
    data?.dailySpending.map((row) => ({
      day: formatDayLabel(row.date),
      date: row.date,
      total: row.total / 100,
      totalMinor: row.total,
    })) ?? [];

  const hasIncomeOrExpenses = barData.some(
    (row) => row.incomeMinor > 0 || row.expensesMinor > 0,
  );
  const hasDailySpend = lineData.some((row) => row.totalMinor > 0);

  const pieTotalMinor = pieData.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <AppShell
      title="Reports"
      description="Server-aggregated spending charts for the selected month."
      month={month}
      maxWidth="5xl"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <MonthSwitcher
            label={formatMonthLabelLong(month)}
            onPrev={() => setMonth((prev) => shiftMonth(prev, -1))}
            onNext={() => setMonth((prev) => shiftMonth(prev, 1))}
          />
          <a
            href={`/api/reports?month=${encodeURIComponent(month)}&format=csv`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
          >
            <IconDownload className="h-4 w-4" />
            Download CSV
          </a>
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        {loading && !data ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartSkeleton />
            <ChartSkeleton />
            <ChartSkeleton className="lg:col-span-2" />
          </div>
        ) : null}

        <SurfaceCard>
          <h2 className="text-lg font-medium text-zinc-900">Savings rate</h2>
          <p className="mb-4 text-sm text-zinc-600">
            (Income − expenses) ÷ income for {formatMonthLabel(month)} (
            {baseCurrency}).
          </p>
          {!data ? (
            <EmptyState title="Savings rate will appear once the report loads." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Income
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-900">
                  {formatMoney(data.savings.income, baseCurrency)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Expenses
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-900">
                  {formatMoney(data.savings.expenses, baseCurrency)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Savings rate
                </p>
                <p className="mt-1 text-xl font-semibold text-teal-800">
                  {data.savings.rate == null
                    ? "N/A"
                    : `${data.savings.rate}%`}
                </p>
                {data.savings.rate == null ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Add income this month to calculate a rate.
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </SurfaceCard>

        {data ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard>
            <h2 className="text-lg font-medium text-zinc-900">
              Spending by category
            </h2>
            <p className="mb-4 text-sm text-zinc-600">
              Donut chart for the selected month ({baseCurrency}).
            </p>
            <div className="relative h-72 w-full">
              {pieData.length === 0 ? (
                <EmptyState title="No spending this month." description="Expenses you add will show up here." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={96}
                        paddingAngle={3}
                        cornerRadius={4}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) =>
                          typeof value === "number"
                            ? formatMoney(value, baseCurrency)
                            : String(value ?? "")
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Total
                    </p>
                    <p className="font-heading text-lg font-semibold tabular-nums text-foreground">
                      {formatMoney(pieTotalMinor, baseCurrency)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {data && data.byCategory.length > 0 ? (
              <ul className="mt-4 divide-y divide-zinc-200 border-t border-zinc-200">
                {data.byCategory.map((slice, index) => {
                  const comparison = categoryComparisonText(slice);
                  return (
                    <li
                      key={slice.categoryId}
                      className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                PIE_COLORS[index % PIE_COLORS.length],
                            }}
                            aria-hidden
                          />
                          <p className="font-medium text-zinc-900">
                            {slice.category}{" "}
                            <span className="font-normal text-zinc-500">
                              {slice.percentage}%
                            </span>
                          </p>
                        </div>
                        {comparison ? (
                          <p className="mt-1 pl-5 text-xs text-zinc-500">
                            {comparison}
                          </p>
                        ) : null}
                      </div>
                      <p className="pl-5 text-sm font-semibold text-zinc-900 sm:pl-0 sm:text-right">
                        {formatMoney(slice.total, baseCurrency)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </SurfaceCard>

          <SurfaceCard>
            <h2 className="text-lg font-medium text-zinc-900">
              Income vs expenses
            </h2>
            <p className="mb-4 text-sm text-zinc-600">
              Last 6 months ({baseCurrency}).
            </p>
            <div className="h-72 w-full">
              {!hasIncomeOrExpenses ? (
                <EmptyState title="No income or expenses yet." description="Track a few months to see this chart." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} barGap={4} barCategoryGap="18%">
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748b" }} width={48} />
                    <Tooltip
                      formatter={(value, name) => {
                        const label =
                          name === "income"
                            ? "Income"
                            : name === "expenses"
                              ? "Expenses"
                              : String(name ?? "");
                        return [
                          typeof value === "number"
                            ? formatMoney(Math.round(value * 100), baseCurrency)
                            : String(value ?? ""),
                          label,
                        ];
                      }}
                    />
                    <Legend
                      formatter={(value) =>
                        value === "income"
                          ? "Income"
                          : value === "expenses"
                            ? "Expenses"
                            : value
                      }
                    />
                    <Bar
                      dataKey="income"
                      fill={CHART_INCOME}
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="expenses"
                      fill={CHART_EXPENSE}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </SurfaceCard>
        </section>
        ) : null}

        {data ? (
        <SurfaceCard>
          <h2 className="text-lg font-medium text-zinc-900">Daily spending</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Day-by-day totals for {formatMonthLabel(month)} ({baseCurrency}).
          </p>
          <div className="h-72 w-full">
            {!hasDailySpend ? (
              <EmptyState title="No daily spending yet." description="This month has no expense activity." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} width={48} />
                  <Tooltip
                    labelFormatter={(_, payload) => {
                      const point = payload?.[0]?.payload as
                        | { date?: string }
                        | undefined;
                      return point?.date ?? "";
                    }}
                    formatter={(value) =>
                      typeof value === "number"
                        ? formatMoney(Math.round(value * 100), baseCurrency)
                        : String(value ?? "")
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={CHART_PRIMARY}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: CHART_PRIMARY }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </SurfaceCard>
        ) : null}

        {data ? (
        <SurfaceCard>
          <h2 className="text-lg font-medium text-zinc-900">
            Top 5 biggest expenses
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            Largest items in the selected month ({baseCurrency}).
          </p>
          {data.topExpenses.length === 0 ? (
            <EmptyState title="No big expenses yet." description="Your top five will appear here." />
          ) : (
            <ol className="divide-y divide-zinc-200 border-y border-zinc-200">
              {data.topExpenses.map((expense, index) => (
                <li
                  key={expense.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-zinc-900">
                      <span className="mr-2 text-zinc-400">{index + 1}.</span>
                      {expense.description}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {expense.category} · {expense.date.slice(0, 10)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-zinc-900">
                      {formatMoney(expense.amount, baseCurrency)}
                    </p>
                    {expense.currency &&
                    expense.currency !== baseCurrency &&
                    expense.originalAmount != null ? (
                      <p className="text-xs text-zinc-500">
                        {formatMoney(expense.originalAmount, expense.currency)}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </SurfaceCard>
        ) : null}
      </div>
    </AppShell>
  );
}
