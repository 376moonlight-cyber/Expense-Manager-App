"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell, SurfaceCard } from "@/components/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";
import { BudgetProgressBar } from "@/components/BudgetProgressBar";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "@/lib/currency";
import { formatMoney, fromMinorUnits } from "@/lib/money";

type Goal = {
  id: string;
  name: string;
  targetAmountMinor: number;
  savedAmountMinor: number;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
};

type GoalForm = {
  name: string;
  targetAmount: string;
  savedAmount: string;
  deadline: string;
};

function emptyGoalForm(): GoalForm {
  return {
    name: "",
    targetAmount: "",
    savedAmount: "0.00",
    deadline: "",
  };
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "No deadline";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export default function GoalsPage() {
  const { confirm } = useConfirm();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_BASE_CURRENCY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<GoalForm>(emptyGoalForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [savingGoalId, setSavingGoalId] = useState<string | null>(null);
  const [addAmounts, setAddAmounts] = useState<Record<string, string>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [goalsRes, settingsRes] = await Promise.all([
        fetch("/api/goals"),
        fetch("/api/settings"),
      ]);

      if (!goalsRes.ok) {
        const body = (await goalsRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load goals.");
      }

      const nextGoals = (await goalsRes.json()) as Goal[];
      const nextSettings = settingsRes.ok
        ? ((await settingsRes.json()) as { baseCurrency?: string })
        : null;

      setGoals(nextGoals);
      setBaseCurrency(normalizeCurrencyCode(nextSettings?.baseCurrency));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer so setState inside loadData is not synchronous in the effect body.
    void Promise.resolve().then(() => loadData());
  }, [loadData]);

  function resetForm() {
    setEditingId(null);
    setFormMessage(null);
    setForm(emptyGoalForm());
  }

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setFormMessage(null);
    setForm({
      name: goal.name,
      targetAmount: fromMinorUnits(goal.targetAmountMinor).toFixed(2),
      savedAmount: fromMinorUnits(goal.savedAmountMinor).toFixed(2),
      deadline: goal.deadline ? goal.deadline.slice(0, 10) : "",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage(null);

    const targetAmount = Number(form.targetAmount);
    const savedAmount = Number(form.savedAmount || "0");

    if (!form.name.trim()) {
      setFormMessage("Name is required.");
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setFormMessage("Enter a positive target amount.");
      return;
    }
    if (!Number.isFinite(savedAmount) || savedAmount < 0) {
      setFormMessage("Saved amount cannot be negative.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        editingId ? `/api/goals/${editingId}` : "/api/goals",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            targetAmount,
            savedAmount,
            deadline: form.deadline || null,
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not save goal.");
      }

      resetForm();
      await loadData();
      toast.success(editingId ? "Goal updated." : "Goal added.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save goal.";
      setFormMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(goal: Goal) {
    const confirmed = await confirm({
      title: "Delete goal?",
      description: `Delete goal “${goal.name}”?`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/goals/${goal.id}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to delete goal.");
      }
      if (editingId === goal.id) resetForm();
      await loadData();
      toast.success("Goal deleted.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete goal.";
      setError(message);
      toast.error(message);
    }
  }

  async function handleAddSavings(goal: Goal) {
    const raw = addAmounts[goal.id] ?? "";
    const amount = Number(raw);
    setSaveErrors((prev) => ({ ...prev, [goal.id]: "" }));

    if (!Number.isFinite(amount) || amount <= 0) {
      setSaveErrors((prev) => ({
        ...prev,
        [goal.id]: "Enter a positive amount.",
      }));
      return;
    }

    setSavingGoalId(goal.id);
    try {
      const response = await fetch(`/api/goals/${goal.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not add savings.");
      }
      setAddAmounts((prev) => ({ ...prev, [goal.id]: "" }));
      await loadData();
      toast.success("Savings added.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not add savings.";
      setSaveErrors((prev) => ({
        ...prev,
        [goal.id]: message,
      }));
      toast.error(message);
    } finally {
      setSavingGoalId(null);
    }
  }

  return (
    <AppShell
      title="Savings goals"
      description="Set targets and track progress toward them."
      maxWidth="3xl"
    >
      <div className="flex flex-col gap-6">
        <SurfaceCard id="add-goal">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit goal" : "Add goal"}
            </h2>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-medium text-zinc-500 transition hover:text-zinc-800"
              >
                Cancel
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-foreground">Name</span>
              <input
                type="text"
                maxLength={80}
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. Emergency fund"
                className="min-h-12 rounded-xl border border-border bg-card px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                Target amount ({baseCurrency})
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={form.targetAmount}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    targetAmount: event.target.value,
                  }))
                }
                placeholder="0.00"
                className="min-h-12 rounded-xl border border-border bg-card px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                Already saved ({baseCurrency})
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={form.savedAmount}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    savedAmount: event.target.value,
                  }))
                }
                className="min-h-12 rounded-xl border border-border bg-card px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-foreground">
                Deadline{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                type="date"
                value={form.deadline}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    deadline: event.target.value,
                  }))
                }
                className="min-h-12 rounded-xl border border-border bg-card px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            {formMessage ? (
              <p className="sm:col-span-2 text-sm text-expense">{formMessage}</p>
            ) : null}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {submitting
                  ? "Saving…"
                  : editingId
                    ? "Update goal"
                    : "Add goal"}
              </button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="mb-4 text-lg font-semibold">Your goals</h2>

          {loading ? (
            <ListSkeleton rows={3} />
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => void loadData()}
                className="mt-3 text-sm font-semibold text-red-700 underline-offset-2 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : goals.length === 0 ? (
            <EmptyState
              title="No savings goals yet."
              description="Create one above to track progress."
              actionLabel="Add goal"
              onAction={() =>
                document
                  .getElementById("add-goal")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            />
          ) : (
            <ul className="space-y-5">
              {goals.map((goal) => {
                const pct = Math.min(
                  Math.round(
                    (goal.savedAmountMinor / Math.max(goal.targetAmountMinor, 1)) *
                      100,
                  ),
                  100,
                );
                return (
                  <li
                    key={goal.id}
                    className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900">{goal.name}</p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {formatMoney(goal.savedAmountMinor, baseCurrency)} of{" "}
                          {formatMoney(goal.targetAmountMinor, baseCurrency)} ·{" "}
                          {formatDeadline(goal.deadline)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-zinc-700">
                          {pct}%
                        </span>
                        <button
                          type="button"
                          onClick={() => startEdit(goal)}
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-zinc-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(goal)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <BudgetProgressBar
                        spent={goal.savedAmountMinor}
                        limit={goal.targetAmountMinor}
                      />
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Add savings
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={addAmounts[goal.id] ?? ""}
                          onChange={(event) =>
                            setAddAmounts((prev) => ({
                              ...prev,
                              [goal.id]: event.target.value,
                            }))
                          }
                          className="min-h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={savingGoalId === goal.id}
                        onClick={() => void handleAddSavings(goal)}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingGoalId === goal.id
                          ? "Adding…"
                          : "Add savings"}
                      </button>
                    </div>
                    {saveErrors[goal.id] ? (
                      <p className="mt-2 text-sm text-expense">
                        {saveErrors[goal.id]}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </SurfaceCard>
      </div>
    </AppShell>
  );
}
