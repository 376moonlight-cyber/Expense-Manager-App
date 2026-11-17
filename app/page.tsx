"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconBanknote,
  IconCalendar,
  IconFileText,
  IconPencil,
  IconTags,
  IconTrash,
} from "@/components/Icons";
import { AppShell, SurfaceCard } from "@/components/AppShell";
import { BudgetWarningBanner } from "@/components/BudgetWarningBanner";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CountUpMoney } from "@/components/ui/CountUpMoney";
import { EmptyState } from "@/components/ui/EmptyState";
import { Fab } from "@/components/ui/Fab";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ListSkeleton, SummaryCardsSkeleton } from "@/components/ui/Skeleton";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { BudgetRow } from "@/lib/budgets";
import {
  CURRENCIES,
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "@/lib/currency";
import {
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_METHODS,
  expenseDayKey,
  type PaymentMethod,
  toMinorUnits,
} from "@/lib/expenses";
import { formatMoney, fromMinorUnits } from "@/lib/money";

type Category = {
  id: string;
  name: string;
};

type Receipt = {
  id: string;
  expenseId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

type WalletOption = {
  id: string;
  name: string;
  type: string;
};

type Expense = {
  id: string;
  /** Amount in minor units (API field `amount`). */
  amount: number;
  amountMinor: number;
  currency: string;
  convertedAmountMinor: number;
  exchangeRateUsed: number;
  description: string;
  date: string;
  categoryId: string;
  category: Category;
  paymentMethod: PaymentMethod | string;
  notes: string;
  tags: string[];
  walletId: string | null;
  receipt: Receipt | null;
  recurringExpenseId: string | null;
  createdAt: string;
  updatedAt: string;
};

type IncomeSummary = {
  id: string;
  convertedAmountMinor: number;
};

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

function receiptUrl(receiptId: string): string {
  return `/api/receipts/${receiptId}`;
}

function isImageReceipt(mimeType: string): boolean {
  return mimeType === "image/jpeg" || mimeType === "image/png";
}

function validateReceiptFile(file: File | null): string | null {
  if (!file) return null;
  if (!ALLOWED_RECEIPT_TYPES.has(file.type)) {
    return "Receipt must be a JPEG, PNG, or PDF.";
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return "Receipt must be 5 MB or smaller.";
  }
  return null;
}

type FormFields = {
  amount: string;
  currency: string;
  description: string;
  date: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  notes: string;
  tags: string;
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

function formatExpenseDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function emptyForm(categoryId = "", currency = DEFAULT_BASE_CURRENCY): FormFields {
  return {
    amount: "",
    currency,
    description: "",
    date: todayInputValue(),
    categoryId,
    paymentMethod: DEFAULT_PAYMENT_METHOD,
    notes: "",
    tags: "",
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

  if (!fields.description.trim()) {
    errors.description = "Description is required.";
  } else if (fields.description.trim().length > 200) {
    errors.description = "Description must be at most 200 characters.";
  }

  if (!fields.date) {
    errors.date = "Date is required.";
  } else if (Number.isNaN(Date.parse(fields.date))) {
    errors.date = "Enter a valid date.";
  }

  if (!fields.categoryId) {
    errors.categoryId = "Category is required.";
  }

  return errors;
}

export default function Home() {
  const { confirm } = useConfirm();
  // Defer calendar reads until mount — Cache Components forbids `new Date()` in prerender.
  const [month, setMonth] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<IncomeSummary[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_BASE_CURRENCY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormFields>({
    amount: "",
    currency: DEFAULT_BASE_CURRENCY,
    description: "",
    date: "",
    categoryId: "",
    paymentMethod: DEFAULT_PAYMENT_METHOD,
    notes: "",
    tags: "",
    walletId: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [existingReceipt, setExistingReceipt] = useState<Receipt | null>(null);
  const [viewerReceipt, setViewerReceipt] = useState<Receipt | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (!month) return;

    setLoading(true);
    setError(null);

    try {
      const [
        categoriesRes,
        expensesRes,
        incomeRes,
        budgetsRes,
        settingsRes,
        walletsRes,
      ] = await Promise.all([
        fetch("/api/categories"),
        fetch(`/api/expenses?month=${encodeURIComponent(month)}`),
        fetch(`/api/income?month=${encodeURIComponent(month)}`),
        fetch(`/api/budgets?month=${encodeURIComponent(month)}`),
        fetch("/api/settings"),
        fetch("/api/wallets"),
      ]);

      if (!categoriesRes.ok) {
        const body = (await categoriesRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load categories.");
      }

      if (!expensesRes.ok) {
        const body = (await expensesRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load expenses.");
      }

      const [nextCategories, nextExpenses] = (await Promise.all([
        categoriesRes.json(),
        expensesRes.json(),
      ])) as [Category[], Expense[]];

      // Income/budgets/settings are optional on this page — don't block the expense list.
      const nextIncomes = incomeRes.ok
        ? ((await incomeRes.json()) as IncomeSummary[])
        : [];
      const nextBudgets = budgetsRes.ok
        ? ((await budgetsRes.json()) as BudgetRow[])
        : [];
      const nextSettings = settingsRes.ok
        ? ((await settingsRes.json()) as { baseCurrency?: string })
        : null;
      const nextWallets = walletsRes.ok
        ? ((await walletsRes.json()) as WalletOption[])
        : [];
      const nextBase = normalizeCurrencyCode(nextSettings?.baseCurrency);

      setCategories(nextCategories);
      setWallets(nextWallets);
      setExpenses(nextExpenses);
      setIncomes(nextIncomes);
      setBudgets(nextBudgets);
      setBaseCurrency(nextBase);

      setForm((prev) => ({
        ...prev,
        categoryId: prev.categoryId || nextCategories[0]?.id || "",
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

  const filteredExpenses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const minMinor =
      minAmount.trim() !== "" && Number.isFinite(Number(minAmount))
        ? Math.round(Number(minAmount) * 100)
        : null;
    const maxMinor =
      maxAmount.trim() !== "" && Number.isFinite(Number(maxAmount))
        ? Math.round(Number(maxAmount) * 100)
        : null;
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTime = dateTo
      ? (() => {
          const end = new Date(dateTo);
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
            end.setHours(23, 59, 59, 999);
          }
          return end.getTime();
        })()
      : null;

    return expenses.filter((expense) => {
      if (categoryFilter && expense.categoryId !== categoryFilter) {
        return false;
      }
      if (paymentMethodFilter && expense.paymentMethod !== paymentMethodFilter) {
        return false;
      }
      if (tagFilter) {
        const needle = tagFilter.toLowerCase();
        if (!(expense.tags ?? []).some((tag) => tag.toLowerCase() === needle)) {
          return false;
        }
      }
      if (
        query &&
        !expense.description.toLowerCase().includes(query)
      ) {
        return false;
      }
      const expenseTime = new Date(expense.date).getTime();
      if (fromTime != null && !Number.isNaN(fromTime) && expenseTime < fromTime) {
        return false;
      }
      if (toTime != null && !Number.isNaN(toTime) && expenseTime > toTime) {
        return false;
      }
      if (minMinor != null && expense.convertedAmountMinor < minMinor) {
        return false;
      }
      if (maxMinor != null && expense.convertedAmountMinor > maxMinor) {
        return false;
      }
      return true;
    });
  }, [
    expenses,
    categoryFilter,
    paymentMethodFilter,
    tagFilter,
    searchQuery,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
  ]);

  const availableTags = useMemo(() => {
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const expense of expenses) {
      for (const tag of expense.tags ?? []) {
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
      }
    }
    return tags.sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  const hasActiveFilters =
    Boolean(categoryFilter) ||
    Boolean(paymentMethodFilter) ||
    Boolean(tagFilter) ||
    Boolean(searchQuery.trim()) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(minAmount.trim()) ||
    Boolean(maxAmount.trim());

  function clearFilters() {
    setCategoryFilter("");
    setPaymentMethodFilter("");
    setTagFilter("");
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setMinAmount("");
    setMaxAmount("");
  }

  const monthExpenseTotalMinor = useMemo(
    () =>
      expenses.reduce((sum, expense) => sum + expense.convertedAmountMinor, 0),
    [expenses],
  );

  const monthIncomeTotalMinor = useMemo(
    () =>
      incomes.reduce((sum, income) => sum + income.convertedAmountMinor, 0),
    [incomes],
  );

  const monthBalanceMinor = monthIncomeTotalMinor - monthExpenseTotalMinor;

  const budgetRemainingMinor = useMemo(() => {
    const withLimits = budgets.filter(
      (b) => b.monthlyLimit != null && b.monthlyLimit > 0,
    );
    if (withLimits.length === 0) return null;
    const totalLimit = withLimits.reduce(
      (sum, b) => sum + (b.monthlyLimit ?? 0),
      0,
    );
    const totalSpent = withLimits.reduce((sum, b) => sum + b.spent, 0);
    return totalLimit - totalSpent;
  }, [budgets]);

  const budgetsOverEighty = useMemo(
    () =>
      budgets.filter(
        (b) =>
          b.monthlyLimit != null &&
          b.monthlyLimit > 0 &&
          b.spent / b.monthlyLimit >= 0.8,
      ),
    [budgets],
  );

  function updateField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormMessage(null);
  }

  function clearReceiptPicker() {
    setReceiptFile(null);
    setReceiptError(null);
    if (receiptInputRef.current) {
      receiptInputRef.current.value = "";
    }
  }

  function resetForm(nextCategoryId?: string) {
    setEditingId(null);
    setFieldErrors({});
    setFormMessage(null);
    setExistingReceipt(null);
    clearReceiptPicker();
    setForm(
      emptyForm(
        nextCategoryId ?? categories[0]?.id ?? form.categoryId,
        baseCurrency,
      ),
    );
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setFieldErrors({});
    setFormMessage(null);
    setExistingReceipt(expense.receipt);
    clearReceiptPicker();
    const method = PAYMENT_METHODS.includes(
      expense.paymentMethod as PaymentMethod,
    )
      ? (expense.paymentMethod as PaymentMethod)
      : DEFAULT_PAYMENT_METHOD;
    setForm({
      amount: fromMinorUnits(expense.amount).toFixed(2),
      currency: expense.currency || baseCurrency,
      description: expense.description,
      date: expense.date.slice(0, 10),
      categoryId: expense.categoryId,
      paymentMethod: method,
      notes: expense.notes ?? "",
      tags: (expense.tags ?? []).join(", "),
      walletId: expense.walletId ?? "",
    });
  }

  function handleReceiptChange(fileList: FileList | null) {
    const file = fileList?.[0] ?? null;
    const error = validateReceiptFile(file);
    setReceiptError(error);
    setReceiptFile(error ? null : file);
    setFormMessage(null);
  }

  async function uploadReceipt(expenseId: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`/api/expenses/${expenseId}/receipt`, {
      method: "POST",
      body,
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) {
      throw new Error(payload?.error ?? "Could not upload receipt.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage(null);

    const errors = validateForm(form);
    setFieldErrors(errors);

    const fileError = validateReceiptFile(receiptFile);
    setReceiptError(fileError);
    if (Object.keys(errors).length > 0 || fileError) return;

    const amountMinor = toMinorUnits(Number(form.amount));
    const dayKey = form.date;

    if (!editingId) {
      const duplicate = expenses.find(
        (expense) =>
          expense.amountMinor === amountMinor &&
          expense.categoryId === form.categoryId &&
          expenseDayKey(expense.date) === dayKey,
      );
      if (duplicate) {
        const confirmed = await confirm({
          title: "Duplicate expense?",
          description:
            "You already have an expense with the same amount, category, and date. Add it anyway?",
          confirmLabel: "Add anyway",
          tone: "default",
        });
        if (!confirmed) return;
      }
    }

    setSubmitting(true);

    const payload = {
      amount: Number(form.amount),
      currency: form.currency,
      description: form.description.trim(),
      date: form.date,
      categoryId: form.categoryId,
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim(),
      tags: form.tags,
      walletId: form.walletId || null,
    };

    try {
      const response = await fetch(
        editingId ? `/api/expenses/${editingId}` : "/api/expenses",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        id?: string;
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
        throw new Error(body?.error ?? "Could not save expense.");
      }

      const expenseId = editingId ?? body?.id;
      if (receiptFile && expenseId) {
        await uploadReceipt(expenseId, receiptFile);
      }

      resetForm(payload.categoryId);
      await loadData();
      toast.success(
        editingId ? "Expense updated." : "Expense added.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save expense.";
      setFormMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(expense: Expense) {
    const confirmed = await confirm({
      title: "Delete expense?",
      description: `Delete “${expense.description}” (${formatMoney(expense.convertedAmountMinor, baseCurrency)})?`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/expenses/${expense.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to delete expense.");
      }

      if (editingId === expense.id) {
        resetForm(expense.categoryId);
      }

      await loadData();
      toast.success("Expense deleted.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete expense.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <AppShell
      title="Expenses"
      description="Track spending by month and category."
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
        <BudgetWarningBanner
          budgets={budgets}
          month={month}
          currency={baseCurrency}
        />

        {loading ? (
          <SummaryCardsSkeleton count={3} />
        ) : (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary via-primary to-emerald-600 p-6 text-primary-foreground shadow-card sm:col-span-2 lg:col-span-1">
              <p className="text-sm font-medium text-primary-foreground/85">
                Balance · {formatMonthLabel(month)}
              </p>
              <p className="mt-2 min-w-0 break-words font-heading text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
                <CountUpMoney
                  valueMinor={monthBalanceMinor}
                  currency={baseCurrency}
                />
              </p>
              {budgetRemainingMinor != null ? (
                <p
                  className={cn(
                    "mt-3 text-sm tabular-nums text-primary-foreground/80",
                    budgetRemainingMinor < 0 && "text-white/90",
                  )}
                >
                  Budget left: {formatMoney(budgetRemainingMinor, baseCurrency)}
                </p>
              ) : null}
            </div>
            <SurfaceCard className="flex min-w-0 flex-col justify-between px-5 py-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Income
                </p>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-income-muted text-income">
                  <IconArrowUpRight className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 min-w-0 break-words text-xl font-semibold tracking-tight tabular-nums text-income sm:text-2xl">
                <CountUpMoney
                  valueMinor={monthIncomeTotalMinor}
                  currency={baseCurrency}
                />
              </p>
            </SurfaceCard>
            <SurfaceCard className="flex min-w-0 flex-col justify-between px-5 py-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Expenses
                </p>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-expense-muted text-expense">
                  <IconArrowDownRight className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 min-w-0 break-words text-xl font-semibold tracking-tight tabular-nums text-expense sm:text-2xl">
                <CountUpMoney
                  valueMinor={monthExpenseTotalMinor}
                  currency={baseCurrency}
                />
              </p>
              {budgetsOverEighty.length > 0 ? (
                <p className="mt-2 text-xs font-medium text-accent">
                  {budgetsOverEighty.length === 1
                    ? `${budgetsOverEighty[0].categoryName} is over 80% of its budget`
                    : `${budgetsOverEighty.length} category budgets are over 80%`}
                </p>
              ) : null}
            </SurfaceCard>
          </section>
        )}

        <Card id="add-form" className="scroll-mt-24 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-0">
            <CardTitle className="text-lg">
              {editingId ? "Edit expense" : "Add expense"}
            </CardTitle>
            {editingId ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => resetForm()}>
                Cancel
              </Button>
            ) : null}
          </CardHeader>

          <CardBody>
          <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2 sm:col-span-1">
              <span className="text-sm font-medium text-foreground">Amount</span>
              <div className="relative">
                <IconBanknote className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="next"
                  autoComplete="off"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(event) => updateField("amount", event.target.value)}
                  error={Boolean(fieldErrors.amount)}
                  className="min-h-12 pl-10"
                />
              </div>
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
              <span className="text-sm font-medium text-foreground">Date</span>
              <div className="relative">
                <IconCalendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={form.date}
                  onChange={(event) => updateField("date", event.target.value)}
                  error={Boolean(fieldErrors.date)}
                  className="min-h-12 pl-10"
                />
              </div>
              {fieldErrors.date ? (
                <span className="text-sm text-expense">{fieldErrors.date}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-foreground">
                Description
              </span>
              <div className="relative">
                <IconFileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  maxLength={200}
                  enterKeyHint="next"
                  autoComplete="off"
                  placeholder="What did you spend on?"
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  error={Boolean(fieldErrors.description)}
                  className="min-h-12 pl-10"
                />
              </div>
              {fieldErrors.description ? (
                <span className="text-sm text-expense">
                  {fieldErrors.description}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 sm:col-span-1">
              <span className="text-sm font-medium text-foreground">Category</span>
              <Select
                value={form.categoryId}
                onChange={(event) =>
                  updateField("categoryId", event.target.value)
                }
                error={Boolean(fieldErrors.categoryId)}
                className="min-h-12"
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
              </Select>
              {fieldErrors.categoryId ? (
                <span className="text-sm text-expense">
                  {fieldErrors.categoryId}
                </span>
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

            <label className="flex flex-col gap-2 sm:col-span-1">
              <span className="text-sm font-medium text-foreground">
                Payment method
              </span>
              <Select
                value={form.paymentMethod}
                onChange={(event) =>
                  updateField(
                    "paymentMethod",
                    event.target.value as PaymentMethod,
                  )
                }
                className="min-h-12"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </Select>
            </label>

            <label className="flex flex-col gap-2 sm:col-span-1">
              <span className="text-sm font-medium text-foreground">
                Tags{" "}
                <span className="font-normal text-muted-foreground">
                  (comma separated)
                </span>
              </span>
              <div className="relative">
                <IconTags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  enterKeyHint="next"
                  autoComplete="off"
                  placeholder="food, lunch"
                  value={form.tags}
                  onChange={(event) => updateField("tags", event.target.value)}
                  className="min-h-12 pl-10"
                />
              </div>
            </label>

            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700">
                Notes{" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <textarea
                rows={2}
                maxLength={1000}
                placeholder="Any extra details…"
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
            </label>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700">
                Receipt{" "}
                <span className="font-normal text-zinc-500">
                  (JPEG, PNG, or PDF · max 5 MB)
                </span>
              </span>
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                onChange={(event) => handleReceiptChange(event.target.files)}
                className="block w-full min-h-12 text-base text-zinc-600 file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2.5 file:text-base file:font-medium file:text-teal-800 hover:file:bg-teal-100"
              />
              {receiptFile ? (
                <p className="text-sm text-zinc-600">
                  Selected: {receiptFile.name}
                  <button
                    type="button"
                    onClick={clearReceiptPicker}
                    className="ml-2 min-h-11 px-1 font-medium text-zinc-500 underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                </p>
              ) : existingReceipt ? (
                <p className="text-sm text-zinc-600">
                  Current: {existingReceipt.fileName} — choose a file to replace
                  it.
                </p>
              ) : null}
              {receiptError ? (
                <span className="text-sm text-red-600">{receiptError}</span>
              ) : null}
            </div>

            {formMessage ? (
              <p className="sm:col-span-2 text-sm text-red-600">{formMessage}</p>
            ) : null}

            <div className="sm:col-span-2">
              <Button
                type="submit"
                size="lg"
                disabled={submitting || categories.length === 0}
                className="w-full sm:w-auto"
              >
                {submitting
                  ? "Saving…"
                  : editingId
                    ? "Update expense"
                    : "Add expense"}
              </Button>
            </div>
          </form>
          </CardBody>
        </Card>

        <SurfaceCard>
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Expenses</h2>
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline"
              >
                Clear filters
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <label className="flex flex-col gap-1.5 xl:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Search description
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="e.g. groceries"
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Category
                </span>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Payment method
                </span>
                <select
                  value={paymentMethodFilter}
                  onChange={(event) =>
                    setPaymentMethodFilter(event.target.value)
                  }
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">All methods</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Tag
                </span>
                <select
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value)}
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">All tags</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  From date
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  To date
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Min amount
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={minAmount}
                  onChange={(event) => setMinAmount(event.target.value)}
                  placeholder="0"
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Max amount
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={maxAmount}
                  onChange={(event) => setMaxAmount(event.target.value)}
                  placeholder="Any"
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </label>
            </div>
          </div>

          {loading ? (
            <ListSkeleton rows={5} />
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
          ) : filteredExpenses.length === 0 ? (
            <EmptyState
              title={
                expenses.length === 0
                  ? "No expenses yet."
                  : "No matching expenses."
              }
              description={
                expenses.length === 0
                  ? "Add your first one using the form above."
                  : "Try adjusting your filters."
              }
              actionLabel={expenses.length === 0 ? "Add expense" : undefined}
              onAction={
                expenses.length === 0
                  ? () =>
                      document
                        .getElementById("add-form")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {filteredExpenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <CategoryIcon
                      name={expense.category.name}
                      size="lg"
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {expense.description}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {expense.category.name}
                        <span aria-hidden className="mx-1.5">
                          ·
                        </span>
                        {formatExpenseDate(expense.date)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {expense.paymentMethod ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {expense.paymentMethod}
                          </span>
                        ) : null}
                        {expense.recurringExpenseId ? (
                          <span className="rounded-full bg-primary-muted px-2 py-0.5 text-[11px] font-medium text-primary">
                            Recurring
                          </span>
                        ) : null}
                        {expense.receipt ? (
                          <button
                            type="button"
                            onClick={() => setViewerReceipt(expense.receipt)}
                            className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Receipt
                          </button>
                        ) : null}
                        {(expense.tags ?? []).map((tag) => (
                          <span
                            key={`${expense.id}-${tag}`}
                            className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <p className="text-base font-semibold tabular-nums text-expense">
                        {formatMoney(
                          expense.convertedAmountMinor,
                          baseCurrency,
                        )}
                      </p>
                      {expense.currency !== baseCurrency ? (
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {formatMoney(expense.amount, expense.currency)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(expense)}
                        aria-label={`Edit ${expense.description}`}
                      >
                        <IconPencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDelete(expense)}
                        aria-label={`Delete ${expense.description}`}
                        className="text-expense hover:bg-expense-muted hover:text-expense"
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

      <Fab
        label="Add expense"
        className="bottom-[calc(5.25rem+env(safe-area-inset-bottom))]"
        onClick={() => {
          const el = document.getElementById("add-form");
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
          const amountInput = el?.querySelector<HTMLInputElement>(
            'input[inputmode="decimal"]',
          );
          amountInput?.focus();
        }}
      />

      {viewerReceipt ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Receipt ${viewerReceipt.fileName}`}
          onClick={() => setViewerReceipt(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <p className="truncate text-sm font-medium text-zinc-800">
                {viewerReceipt.fileName}
              </p>
              <button
                type="button"
                onClick={() => setViewerReceipt(null)}
                className="rounded-lg px-2 py-1 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-zinc-100 p-3">
              {isImageReceipt(viewerReceipt.mimeType) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={receiptUrl(viewerReceipt.id)}
                  alt={viewerReceipt.fileName}
                  className="mx-auto max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
                />
              ) : (
                <iframe
                  title={viewerReceipt.fileName}
                  src={receiptUrl(viewerReceipt.id)}
                  className="h-[75vh] w-full rounded-lg border border-zinc-200 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
