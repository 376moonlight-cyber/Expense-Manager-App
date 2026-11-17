"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { currentMonthKey } from "@/lib/expenses";
import { formatMoney } from "@/lib/money";

type CategorySlice = {
  categoryId: string;
  category: string;
  total: number;
};

type MonthBar = {
  month: string;
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

type ReportsPayload = {
  month: string;
  baseCurrency?: string;
  byCategory: CategorySlice[];
  byMonth: MonthBar[];
  topExpenses: TopExpense[];
};

const PIE_COLORS = [
  "#0f766e",
  "#0369a1",
  "#b45309",
  "#be123c",
  "#4f46e5",
  "#15803d",
  "#7c2d12",
];

function formatMonthLabel(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return "…";
  const [year, mon] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, mon - 1, 1));
}

export function ReportsClient() {
  // Defer calendar reads until mount — Cache Components forbids `new Date()` in prerender.
  const [month, setMonth] = useState("");
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!month) {
      setMonth(currentMonthKey());
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

    void load();
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
      total: row.total / 100,
      totalMinor: row.total,
    })) ?? [];

  return (
    <div className="min-h-full bg-zinc-100 text-zinc-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <nav className="flex items-center gap-3 text-sm">
              <Link href="/" className="text-zinc-600 hover:text-zinc-900">
                ← Expenses
              </Link>
              <span className="text-zinc-300">/</span>
              <Link
                href={`/budgets?month=${encodeURIComponent(month)}`}
                className="text-zinc-600 hover:text-zinc-900"
              >
                Budgets
              </Link>
              <span className="text-zinc-300">/</span>
              <Link
                href="/settings"
                className="text-zinc-600 hover:text-zinc-900"
              >
                Settings
              </Link>
              <span className="text-zinc-300">/</span>
              <span className="font-medium text-zinc-900">Reports</span>
            </nav>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Reports
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Server-aggregated spending charts for the selected month.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              Month
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </label>
            <a
              href={`/api/reports?month=${encodeURIComponent(month)}&format=csv`}
              className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Download CSV
            </a>
          </div>
        </header>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        {loading && !data ? (
          <p className="text-sm text-zinc-500">Loading report…</p>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-medium text-zinc-900">
              Spending by category
            </h2>
            <p className="mb-4 text-sm text-zinc-600">
              Donut chart for the selected month ({baseCurrency}).
            </p>
            <div className="h-72 w-full">
              {pieData.length === 0 ? (
                <EmptyState label="No spending in this month." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={96}
                      paddingAngle={2}
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
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-medium text-zinc-900">Last 6 months</h2>
            <p className="mb-4 text-sm text-zinc-600">
              Total spending per month ({baseCurrency}).
            </p>
            <div className="h-72 w-full">
              {barData.every((row) => row.totalMinor === 0) ? (
                <EmptyState label="No spending in the last 6 months." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={48} />
                    <Tooltip
                      formatter={(value) =>
                        typeof value === "number"
                          ? formatMoney(Math.round(value * 100), baseCurrency)
                          : String(value ?? "")
                      }
                    />
                    <Bar dataKey="total" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-medium text-zinc-900">
            Top 5 biggest expenses
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            Largest items in the selected month ({baseCurrency}).
          </p>
          {!data || data.topExpenses.length === 0 ? (
            <EmptyState label="No expenses to rank this month." />
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
        </section>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 text-sm text-zinc-500">
      {label}
    </div>
  );
}
