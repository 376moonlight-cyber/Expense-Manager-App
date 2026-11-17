"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { IconPencil, IconTrash } from "@/components/Icons";
import { AppShell, SurfaceCard } from "@/components/AppShell";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CountUpMoney } from "@/components/ui/CountUpMoney";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";
import {
  CURRENCIES,
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "@/lib/currency";
import { INCOME_SOURCES } from "@/lib/income";
import { formatMoney, fromMinorUnits } from "@/lib/money";

type WalletOption = {
  id: string;
  name: string;
  type: string;
};

type Income = {
  id: string;
  /** Amount in minor units (API field `amount`). */
  amount: number;
  amountMinor: number;
  currency: string;
  convertedAmountMinor: number;
  exchangeRateUsed: number;
  source: string;
  description: string;
  date: string;
  walletId: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormFields = {
  amount: string;
  currency: string;
  source: string;
  date: string;
  description: string;
  walletId: string;
};

type FieldErrors = Partial<Record<keyof FormFields, string>>;

function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  return currentMonthKey(next);
}

function formatMonthLabel(monthKey: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return "…";
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatIncomeDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function emptyForm(currency = DEFAULT_BASE_CURRENCY): FormFields {
  return {
    amount: "",
    currency,
    source: INCOME_SOURCES[0],
    date: todayInputValue(),
    description: "",
    walletId: "",
  };
}

function validateForm(fields: FormFields): FieldErrors {
  const errors: FieldErrors = {};
  const amount = Number(fields.amount);

  if (!fields.amount.trim()) {
    errors.amount = "Amount is required.";
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Enter a positive amount.";
  } else if (!/^\d+(\.\d{1,2})?$/.test(fields.amount.trim())) {
    errors.amount = "Use at most two decimal places.";
  }

  if (!fields.source.trim()) {
    errors.source = "Source is required.";
  }

  if (!fields.date) {
    errors.date = "Date is required.";
  } else if (Number.isNaN(Date.parse(fields.date))) {
    errors.date = "Enter a valid date.";
  }

  if (fields.description.trim().length > 200) {
    errors.description = "Description must be at most 200 characters.";
  }

  return errors;
}

export default function IncomePage() {
  const { confirm } = useConfirm();
  const [month, setMonth] = useState("");
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_BASE_CURRENCY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormFields>({
    amount: "",
    currency: DEFAULT_BASE_CURRENCY,
    source: INCOME_SOURCES[0],
    date: "",
    description: "",
    walletId: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!month) return;

    setLoading(true);
    setError(null);

    try {
      const [incomeRes, settingsRes, walletsRes] = await Promise.all([
        fetch(`/api/income?month=${encodeURIComponent(month)}`),
        fetch("/api/settings"),
        fetch("/api/wallets"),
      ]);

      if (!incomeRes.ok) {
        const body = (await incomeRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load income.");
      }

      const nextIncomes = (await incomeRes.json()) as Income[];
      const nextSettings = settingsRes.ok
        ? ((await settingsRes.json()) as { baseCurrency?: string })
        : null;
      const nextWallets = walletsRes.ok
        ? ((await walletsRes.json()) as WalletOption[])
        : [];
      const nextBase = normalizeCurrencyCode(nextSettings?.baseCurrency);

      setIncomes(nextIncomes);
      setWallets(nextWallets);
      setBaseCurrency(nextBase);
      setForm((prev) => ({
        ...prev,
        currency: prev.currency || nextBase,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    // Defer so setState is not synchronous in the effect body.
    void Promise.resolve().then(() => {
      if (!month) {
        setMonth(currentMonthKey());
        setForm((prev) =>
          prev.date ? prev : { ...prev, date: todayInputValue() },
        );
        return;
      }
      void loadData();
    });
  }, [loadData, month]);

  const monthTotalMinor = useMemo(
    () =>
      incomes.reduce((sum, income) => sum + income.convertedAmountMinor, 0),
    [incomes],
  );

  function updateField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormMessage(null);
  }

  function resetForm() {
    setEditingId(null);
    setFieldErrors({});
    setFormMessage(null);
    setForm(emptyForm(baseCurrency));
  }

  function startEdit(income: Income) {
    setEditingId(income.id);
    setFieldErrors({});
    setFormMessage(null);
    setForm({
      amount: fromMinorUnits(income.amount).toFixed(2),
      currency: income.currency || baseCurrency,
      source: income.source,
      date: income.date.slice(0, 10),
      description: income.description ?? "",
      walletId: income.walletId ?? "",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage(null);

    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);

    const payload = {
      amount: Number(form.amount),
      currency: form.currency,
      source: form.source.trim(),
      description: form.description.trim(),
      date: form.date,
      walletId: form.walletId || null,
    };

    try {
      const response = await fetch(
        editingId ? `/api/income/${editingId}` : "/api/income",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

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
        throw new Error(body?.error ?? "Could not save income.");
      }

      resetForm();
      await loadData();
      toast.success(editingId ? "Income updated." : "Income added.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save income.";
      setFormMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(income: Income) {
    const label = income.description.trim() || income.source;
    const confirmed = await confirm({
      title: "Delete income?",
      description: `Delete “${label}” (${formatMoney(income.convertedAmountMinor, baseCurrency)})?`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/income/${income.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to delete income.");
      }

      if (editingId === income.id) {
        resetForm();
      }

      await loadData();
      toast.success("Income deleted.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete income.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <AppShell
      title="Income"
      description="Record salary, freelance, and other income."
      month={month}
      maxWidth="3xl"
      actions={
        <MonthSwitcher
          label={formatMonthLabel(month)}
          onPrev={() => setMonth((prev) => shiftMonth(prev, -1))}
          onNext={() => setMonth((prev) => shiftMonth(prev, 1))}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary to-primary-hover px-5 py-6 text-primary-foreground shadow-card card-lift">
          <p className="text-sm font-medium text-primary-foreground/80">
            Total income this month ({baseCurrency})
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {loading ? (
              "—"
            ) : (
              <CountUpMoney valueMinor={monthTotalMinor} currency={baseCurrency} />
            )}
          </p>
        </section>

        <SurfaceCard id="add-income">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold">
              {editingId ? "Edit income" : "Add income"}
            </h2>
            {editingId ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => resetForm()}>
                Cancel
              </Button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2 sm:col-span-1">
              <span className="text-sm font-medium text-foreground">Amount</span>
              <Input
                type="text"
                inputMode="decimal"
                enterKeyHint="next"
                autoComplete="off"
                placeholder="0.00"
                value={form.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                error={Boolean(fieldErrors.amount)}
                className="min-h-12"
              />
              {fieldErrors.amount ? (
                <span className="text-sm text-expense">{fieldErrors.amount}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 sm:col-span-1">
              <span className="text-sm font-medium text-foreground">Currency</span>
              <Select
                value={form.currency}
                onChange={(event) => updateField("currency", event.target.value)}
                error={Boolean(fieldErrors.currency)}
                className="min-h-12"
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
              {fieldErrors.currency ? (
                <span className="text-sm text-expense">
                  {fieldErrors.currency}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 sm:col-span-1">
              <span className="text-sm font-medium text-foreground">Source</span>
              <Select
                value={form.source}
                onChange={(event) => updateField("source", event.target.value)}
                error={Boolean(fieldErrors.source)}
                className="min-h-12"
              >
                {INCOME_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </Select>
              {fieldErrors.source ? (
                <span className="text-sm text-expense">{fieldErrors.source}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 sm:col-span-1">
              <span className="text-sm font-medium text-foreground">Date</span>
              <Input
                type="date"
                value={form.date}
                onChange={(event) => updateField("date", event.target.value)}
                error={Boolean(fieldErrors.date)}
                className="min-h-12"
              />
              {fieldErrors.date ? (
                <span className="text-sm text-expense">{fieldErrors.date}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 sm:col-span-1">
              <span className="text-sm font-medium text-foreground">
                Wallet{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <Select
                value={form.walletId}
                onChange={(event) => updateField("walletId", event.target.value)}
                className="min-h-12"
              >
                <option value="">No wallet</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name} ({wallet.type})
                  </option>
                ))}
              </Select>
            </label>

            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-foreground">
                Description{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <Input
                type="text"
                maxLength={200}
                enterKeyHint="done"
                autoComplete="off"
                placeholder="Notes about this income"
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                error={Boolean(fieldErrors.description)}
                className="min-h-12"
              />
              {fieldErrors.description ? (
                <span className="text-sm text-expense">
                  {fieldErrors.description}
                </span>
              ) : null}
            </label>

            {formMessage ? (
              <p className="sm:col-span-2 text-sm text-expense">{formMessage}</p>
            ) : null}

            <div className="sm:col-span-2">
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting
                  ? "Saving…"
                  : editingId
                    ? "Update income"
                    : "Add income"}
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="mb-4 font-heading text-lg font-semibold">Income</h2>

          {loading ? (
            <ListSkeleton rows={4} />
          ) : error ? (
            <div className="rounded-xl border border-expense/30 bg-expense-muted px-4 py-6 text-center">
              <p className="text-sm text-expense">{error}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void loadData()}
                className="mt-3 text-expense"
              >
                Try again
              </Button>
            </div>
          ) : incomes.length === 0 ? (
            <EmptyState
              title="No income yet."
              description="Add your first entry using the form above."
              actionLabel="Add income"
              onAction={() =>
                document
                  .getElementById("add-income")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {incomes.map((income) => (
                <li
                  key={income.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate font-medium text-foreground">
                        {income.description.trim() || income.source}
                      </p>
                      <Badge variant="income">{income.source}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatIncomeDate(income.date)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <p className="text-base font-semibold tabular-nums text-income">
                        {formatMoney(
                          income.convertedAmountMinor,
                          baseCurrency,
                        )}
                      </p>
                      {income.currency !== baseCurrency ? (
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {formatMoney(income.amount, income.currency)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        aria-label="Edit income"
                        onClick={() => startEdit(income)}
                      >
                        <IconPencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Delete income"
                        className="text-expense hover:bg-expense-muted hover:text-expense"
                        onClick={() => void handleDelete(income)}
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
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
