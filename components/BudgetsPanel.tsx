"use client";

import { useCallback, useEffect, useState } from "react";
import type { BudgetRow } from "@/lib/budgets";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "@/lib/currency";
import { formatMoney } from "@/lib/money";
import { SurfaceCard } from "@/components/AppShell";
import { BudgetProgressBar } from "@/components/BudgetProgressBar";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";

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
          setBaseCurrency(normalizeCurrencyCode(settings.baseCurrency));
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
      toast.success("Budget limit saved.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save budget.";
      setError(message);
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="space-y-4">
      {showMonthPicker && onMonthChange ? (
        <label className="flex flex-col gap-1 text-sm text-muted-foreground">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="min-h-11 rounded-xl border border-border bg-card px-3 text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton rows={6} />
      ) : budgets.length === 0 ? (
        <EmptyState
          title="No categories yet."
          description="Add categories in Settings, then set monthly limits here."
          actionHref="/settings"
          actionLabel="Go to Settings"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {budgets.map((row) => {
            const hasLimit = row.monthlyLimit != null && row.monthlyLimit > 0;
            const isEditing = editingId === row.categoryId;

            return (
              <li key={row.categoryId}>
                <SurfaceCard className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <CategoryIcon name={row.categoryName} size="md" />
                      <span className="font-medium text-foreground">
                        {row.categoryName}
                      </span>
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground">
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
                    <div className="h-2.5 w-full rounded-full bg-muted" />
                  )}

                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Limit (blank to remove)"
                        className="w-44"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveLimit(row.categoryId)}
                        disabled={savingId === row.categoryId}
                      >
                        {savingId === row.categoryId ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto min-h-0 px-0 text-primary hover:bg-transparent"
                      onClick={() => startEdit(row)}
                    >
                      {hasLimit ? "Edit limit" : "Set limit"}
                    </Button>
                  )}
                </SurfaceCard>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
