"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell, SurfaceCard } from "@/components/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/money";

type Category = {
  id: string;
  name: string;
};

type RecurringType = "EXPENSE" | "INCOME";

type RecurringItem = {
  id: string;
  amount: number;
  description: string;
  type: RecurringType;
  categoryId: string | null;
  dayOfMonth: number;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  lastGeneratedMonth: string | null;
  nextDueDate: string | null;
  category: Category | null;
};

type FormFields = {
  amount: string;
  description: string;
  type: RecurringType;
  categoryId: string;
  dayOfMonth: string;
  startDate: string;
  endDate: string;
};

type FieldErrors = Partial<Record<keyof FormFields, string>>;

function emptyForm(categoryId = ""): FormFields {
  return {
    amount: "",
    description: "",
    type: "EXPENSE",
    categoryId,
    dayOfMonth: "1",
    startDate: "",
    endDate: "",
  };
}

function formatDisplayDate(value: string | null): string {
  if (!value) return "—";
  const day = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function validateForm(fields: FormFields): FieldErrors {
  const errors: FieldErrors = {};
  const amount = Number(fields.amount);
  const day = Number(fields.dayOfMonth);

  if (!fields.amount.trim()) {
    errors.amount = "Amount is required.";
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Enter a positive amount.";
  } else if (!/^\d+(\.\d{1,2})?$/.test(fields.amount.trim())) {
    errors.amount = "Use at most two decimal places.";
  }

  if (!fields.description.trim()) {
    errors.description = "Description is required.";
  } else if (fields.description.trim().length > 200) {
    errors.description = "Description must be at most 200 characters.";
  }

  if (fields.type === "EXPENSE" && !fields.categoryId) {
    errors.categoryId = "Category is required.";
  }

  if (!fields.dayOfMonth.trim()) {
    errors.dayOfMonth = "Day is required.";
  } else if (!Number.isInteger(day) || day < 1 || day > 28) {
    errors.dayOfMonth = "Use a day from 1 to 28.";
  }

  if (fields.startDate && fields.endDate && fields.endDate < fields.startDate) {
    errors.endDate = "End date must be on or after start date.";
  }

  return errors;
}

export default function RecurringPage() {
  const { confirm } = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormFields>(emptyForm());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoriesRes, recurringRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/recurring"),
      ]);

      if (!categoriesRes.ok) {
        const body = (await categoriesRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load categories.");
      }
      if (!recurringRes.ok) {
        const body = (await recurringRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load recurring items.");
      }

      const [nextCategories, nextItems] = (await Promise.all([
        categoriesRes.json(),
        recurringRes.json(),
      ])) as [Category[], RecurringItem[]];

      setCategories(nextCategories);
      setItems(nextItems);
      setForm((prev) =>
        prev.categoryId
          ? prev
          : { ...prev, categoryId: nextCategories[0]?.id ?? "" },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer so setState inside load is not synchronous in the effect body.
    void Promise.resolve().then(() => load());
  }, [load]);

  function updateField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage(null);

    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(form.amount),
          description: form.description.trim(),
          type: form.type,
          categoryId: form.type === "EXPENSE" ? form.categoryId : null,
          dayOfMonth: Number(form.dayOfMonth),
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        details?: { path: string; message: string }[];
      } | null;

      if (!response.ok) {
        if (body?.details?.length) {
          const nextErrors: FieldErrors = {};
          for (const detail of body.details) {
            const key = detail.path as keyof FormFields;
            if (key in emptyForm()) nextErrors[key] = detail.message;
          }
          setFieldErrors(nextErrors);
        }
        throw new Error(body?.error ?? "Could not create recurring item.");
      }

      setForm(emptyForm(form.categoryId));
      await load();
      toast.success("Recurring item added.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create recurring item.";
      setFormMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function setActive(item: RecurringItem, active: boolean) {
    setBusyId(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/recurring/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to update recurring item.");
      }
      await load();
      toast.success(active ? "Recurring item resumed." : "Recurring item paused.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update recurring item.";
      setError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: RecurringItem) {
    const confirmed = await confirm({
      title: "Delete recurring item?",
      description: `Delete recurring “${item.description}” (${formatMoney(item.amount)})?`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;

    setBusyId(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/recurring/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to delete recurring item.");
      }
      await load();
      toast.success("Recurring item deleted.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete recurring item.";
      setError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell
      title="Recurring"
      description="Salary, rent, subscriptions, and other monthly income or expenses."
      maxWidth="2xl"
    >
      <div className="flex flex-col gap-6">
        <SurfaceCard id="add-recurring">
          <h2 className="mb-4 text-lg font-semibold">Add recurring</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Type</span>
              <select
                value={form.type}
                onChange={(event) =>
                  updateField("type", event.target.value as RecurringType)
                }
                className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Amount</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                className="min-h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {fieldErrors.amount ? (
                <span className="text-xs text-expense">{fieldErrors.amount}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Day of month (1–28)
              </span>
              <input
                type="number"
                min={1}
                max={28}
                value={form.dayOfMonth}
                onChange={(event) =>
                  updateField("dayOfMonth", event.target.value)
                }
                className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {fieldErrors.dayOfMonth ? (
                <span className="text-xs text-expense">
                  {fieldErrors.dayOfMonth}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-foreground">
                Description
              </span>
              <input
                type="text"
                maxLength={200}
                placeholder={
                  form.type === "INCOME"
                    ? "Salary, stipend…"
                    : "Rent, Netflix, gym…"
                }
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {fieldErrors.description ? (
                <span className="text-xs text-expense">
                  {fieldErrors.description}
                </span>
              ) : null}
            </label>

            {form.type === "EXPENSE" ? (
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-foreground">
                  Category
                </span>
                <select
                  value={form.categoryId}
                  onChange={(event) =>
                    updateField("categoryId", event.target.value)
                  }
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {categories.length === 0 ? (
                    <option value="">No categories available</option>
                  ) : (
                    categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))
                  )}
                </select>
                {fieldErrors.categoryId ? (
                  <span className="text-xs text-expense">
                    {fieldErrors.categoryId}
                  </span>
                ) : null}
              </label>
            ) : null}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Start date{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  updateField("startDate", event.target.value)
                }
                className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                End date{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => updateField("endDate", event.target.value)}
                className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {fieldErrors.endDate ? (
                <span className="text-xs text-expense">{fieldErrors.endDate}</span>
              ) : null}
            </label>

            {formMessage ? (
              <p className="sm:col-span-2 text-sm text-expense">{formMessage}</p>
            ) : null}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={
                  submitting ||
                  (form.type === "EXPENSE" && categories.length === 0)
                }
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Add recurring"}
              </button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="mb-4 text-lg font-semibold">Your recurring items</h2>

          {loading ? (
            <ListSkeleton rows={4} />
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 text-sm font-semibold text-red-700 underline-offset-2 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No recurring items yet."
              description="Add salary, rent, or a subscription above."
              actionLabel="Add recurring"
              onAction={() =>
                document
                  .getElementById("add-recurring")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate font-medium text-zinc-900">
                        {item.description}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.type === "INCOME"
                            ? "bg-sky-50 text-sky-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {item.type === "INCOME" ? "Income" : "Expense"}
                      </span>
                      {item.category ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                          {item.category.name}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {item.active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      Day {item.dayOfMonth}
                      {" · "}
                      Next due {formatDisplayDate(item.nextDueDate)}
                      {item.startDate || item.endDate
                        ? ` · ${formatDisplayDate(item.startDate)} → ${formatDisplayDate(item.endDate)}`
                        : null}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p
                      className={`text-base font-semibold tabular-nums ${
                        item.type === "INCOME"
                          ? "text-emerald-700"
                          : "text-zinc-900"
                      }`}
                    >
                      {item.type === "INCOME" ? "+" : ""}
                      {formatMoney(item.amount)}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void setActive(item, !item.active)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-zinc-50 disabled:opacity-60"
                      >
                        {item.active ? "Pause" : "Resume"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleDelete(item)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>
    </AppShell>
  );
}
