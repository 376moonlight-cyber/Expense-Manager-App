"use client";

import { useCallback, useEffect, useState } from "react";
import type { BudgetRow } from "@/lib/budgets";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatMoney } from "@/lib/money";
import { BudgetProgressBar } from "@/components/BudgetProgressBar";

type BudgetsPanelProps = {
  month: string;
  onMonthChange?: (month: string) => void;
  showMonthPicker?: boolean;
};

export function BudgetsPanel({
  month,
  onMonthChange,
  showMonthPicker = true,
}: BudgetsPanelProps) {
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_BASE_CURRENCY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, settingsRes] = await Promise.all([
        fetch(`/api/budgets?month=${encodeURIComponent(month)}`),
        fetch("/api/settings"),
      ]);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to load budgets.");
      }
      const data = (await res.json()) as BudgetRow[];
      setBudgets(data);

      if (settingsRes.ok) {
        const settings = (await settingsRes.json()) as {
          baseCurrency?: string;
        };
        if (settings.baseCurrency) {
          setBaseCurrency(settings.baseCurrency.toUpperCase());
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budgets.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    // Defer so the effect body does not synchronously trigger setState.
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  function startEdit(row: BudgetRow) {
    setEditingId(row.categoryId);
    setDraft(
      row.monthlyLimit != null ? (row.monthlyLimit / 100).toFixed(2) : ""
    );
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft("");
  }

  async function saveLimit(categoryId: string) {
    setSavingId(categoryId);
    setError(null);
    try {
      const trimmed = draft.trim();
      const monthlyLimit =
        trimmed === "" ? null : Number.parseFloat(trimmed);

      if (monthlyLimit !== null && Number.isNaN(monthlyLimit)) {
        throw new Error("Enter a valid number, or leave blank to remove.");
      }

      const res = await fetch(`/api/budgets/${categoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyLimit }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to save budget.");
      }

      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save budget.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
            Budgets
          </h2>
          <p className="text-sm text-zinc-500">
            Monthly limits per category for {month}
          </p>
        </div>
        {showMonthPicker && onMonthChange ? (
          <label className="flex flex-col gap-1 text-sm text-zinc-600">
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => onMonthChange(e.target.value)}
              className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-zinc-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
          Loading budgets…
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {budgets.map((row) => {
            const hasLimit = row.monthlyLimit != null && row.monthlyLimit > 0;
            const isEditing = editingId === row.categoryId;

            return (
              <li key={row.categoryId} className="space-y-2 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-zinc-900">
                    {row.categoryName}
                  </span>
                  <span className="text-sm tabular-nums text-zinc-600">
                    {formatMoney(row.spent, baseCurrency)}
                    {" / "}
                    {hasLimit
                      ? formatMoney(row.monthlyLimit!, baseCurrency)
                      : "no limit"}
                  </span>
                </div>

                {hasLimit ? (
                  <BudgetProgressBar
                    spent={row.spent}
                    limit={row.monthlyLimit!}
                  />
                ) : (
                  <div className="h-2.5 w-full rounded-full bg-zinc-100" />
                )}

                {isEditing ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Limit (blank to remove)"
                      className="h-10 w-44 rounded-xl border border-zinc-300 px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => void saveLimit(row.categoryId)}
                      disabled={savingId === row.categoryId}
                      className="inline-flex h-10 items-center rounded-xl bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      {savingId === row.categoryId ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline"
                  >
                    {hasLimit ? "Edit limit" : "Set limit"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
