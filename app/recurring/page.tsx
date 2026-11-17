"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";

type Category = {
  id: string;
  name: string;
};

type RecurringItem = {
  id: string;
  amount: number;
  description: string;
  categoryId: string;
  dayOfMonth: number;
  active: boolean;
  lastGeneratedMonth: string | null;
  category: Category;
};

type FormFields = {
  amount: string;
  description: string;
  categoryId: string;
  dayOfMonth: string;
};

type FieldErrors = Partial<Record<keyof FormFields, string>>;

function emptyForm(categoryId = ""): FormFields {
  return {
    amount: "",
    description: "",
    categoryId,
    dayOfMonth: "1",
  };
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

  if (!fields.categoryId) {
    errors.categoryId = "Category is required.";
  }

  if (!fields.dayOfMonth.trim()) {
    errors.dayOfMonth = "Day is required.";
  } else if (!Number.isInteger(day) || day < 1 || day > 28) {
    errors.dayOfMonth = "Use a day from 1 to 28.";
  }

  return errors;
}

export default function RecurringPage() {
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
        throw new Error(body?.error ?? "Failed to load recurring expenses.");
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
    void load();
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
          categoryId: form.categoryId,
          dayOfMonth: Number(form.dayOfMonth),
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
        throw new Error(body?.error ?? "Could not create recurring expense.");
      }

      setForm(emptyForm(form.categoryId));
      await load();
    } catch (err) {
      setFormMessage(
        err instanceof Error ? err.message : "Could not create recurring expense.",
      );
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
        throw new Error(body?.error ?? "Failed to update recurring expense.");
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update recurring expense.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: RecurringItem) {
    const confirmed = window.confirm(
      `Delete recurring “${item.description}” (${formatMoney(item.amount)})?`,
    );
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
        throw new Error(body?.error ?? "Failed to delete recurring expense.");
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete recurring expense.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-full bg-zinc-100 text-zinc-900">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/"
            className="font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            ← Expenses
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="font-medium text-zinc-900">Recurring</span>
          <span className="text-zinc-300">/</span>
          <Link
            href="/budgets"
            className="font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            Budgets
          </Link>
          <span className="text-zinc-300">/</span>
          <Link
            href="/logout"
            className="font-medium text-zinc-500 underline-offset-2 hover:underline"
          >
            Log out
          </Link>
        </nav>

        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            Recurring expenses
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Rent, subscriptions, and other charges that post once each month.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Add recurring</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-700">Amount</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {fieldErrors.amount ? (
                <span className="text-xs text-red-600">{fieldErrors.amount}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-700">
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
                className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {fieldErrors.dayOfMonth ? (
                <span className="text-xs text-red-600">
                  {fieldErrors.dayOfMonth}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700">
                Description
              </span>
              <input
                type="text"
                maxLength={200}
                placeholder="Rent, Netflix, gym…"
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {fieldErrors.description ? (
                <span className="text-xs text-red-600">
                  {fieldErrors.description}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700">Category</span>
              <select
                value={form.categoryId}
                onChange={(event) =>
                  updateField("categoryId", event.target.value)
                }
                className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
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
                <span className="text-xs text-red-600">
                  {fieldErrors.categoryId}
                </span>
              ) : null}
            </label>

            {formMessage ? (
              <p className="sm:col-span-2 text-sm text-red-600">{formMessage}</p>
            ) : null}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting || categories.length === 0}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Add recurring"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Your recurring items</h2>

          {loading ? (
            <p className="rounded-xl bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
              Loading recurring expenses…
            </p>
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
            <p className="rounded-xl bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
              No recurring expenses yet. Add rent or a subscription above.
            </p>
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
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                        {item.category.name}
                      </span>
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
                      {item.lastGeneratedMonth
                        ? ` · last posted ${item.lastGeneratedMonth}`
                        : " · not posted yet"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p className="text-base font-semibold tabular-nums text-zinc-900">
                      {formatMoney(item.amount)}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void setActive(item, !item.active)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
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
        </section>
      </div>
    </div>
  );
}
