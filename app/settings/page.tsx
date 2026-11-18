"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { IconAlertTriangle } from "@/components/Icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { FormSkeleton, ListSkeleton } from "@/components/ui/Skeleton";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";
import {
  CURRENCIES,
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "@/lib/currency";

const BACKUP_REMINDER_DAYS = 30;

function isBackupReminderDue(lastBackupAt: Date | null): boolean {
  if (!lastBackupAt) return true;
  const ageMs = Date.now() - lastBackupAt.getTime();
  return ageMs >= BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000;
}

type SettingsPayload = {
  baseCurrency: string;
  exchangeRates: Record<string, number>;
  lastBackupAt: string | null;
  name: string;
  email: string;
};

type BackupPreview = {
  categories: number;
  expenses: number;
  incomes: number;
  budgets: number;
  receipts: number;
  recurringItems: number;
  wallets: number;
  transfers: number;
  goals: number;
  createdAt: string;
  formatVersion: number;
};

type RateRow = {
  currency: string;
  rate: string;
};

type ImportPreviewRow = {
  rowNumber: number;
  date: string;
  description: string;
  category: string;
  amount: number | null;
  status: "ok" | "error";
  error?: string;
  categoryExists: boolean;
};

type ImportPreview = {
  rows: ImportPreviewRow[];
  validCount: number;
  errorCount: number;
  missingCategories: string[];
};

type Category = {
  id: string;
  name: string;
};

function fieldError(
  details: Array<{ path: string; message: string }> | undefined,
  path: string,
): string | null {
  return details?.find((item) => item.path === path)?.message ?? null;
}

async function downloadCsv(type: "expenses" | "income") {
  const res = await fetch(`/api/settings/export?type=${type}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Failed to export ${type}.`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? `${type}.csv`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const { confirm } = useConfirm();
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_BASE_CURRENCY);
  const [rateRows, setRateRows] = useState<RateRow[]>([
    { currency: "USD", rate: "" },
  ]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(
    null,
  );
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replaceConfirmText, setReplaceConfirmText] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<
    Record<string, string>
  >({});
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load settings.");
      }
      const data = (await res.json()) as SettingsPayload;
      setBaseCurrency(normalizeCurrencyCode(data.baseCurrency));
      setDisplayName(data.name ?? "");
      setEmail(data.email ?? "");
      setLastBackupAt(data.lastBackupAt ?? null);

      const entries = Object.entries(data.exchangeRates ?? {});
      setRateRows(
        entries.length > 0
          ? entries.map(([currency, rate]) => ({
              currency,
              rate: String(rate),
            }))
          : [{ currency: "USD", rate: "" }],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoryError(null);
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load categories.");
      }
      setCategories((await res.json()) as Category[]);
    } catch (err) {
      setCategoryError(
        err instanceof Error ? err.message : "Failed to load categories.",
      );
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer so setState inside loaders is not synchronous in the effect body.
    void Promise.resolve().then(() => {
      void load();
      void loadCategories();
    });
  }, [load, loadCategories]);

  const availableRateCurrencies = useMemo(
    () => CURRENCIES.filter((code) => code !== baseCurrency),
    [baseCurrency],
  );

  function updateRateRow(index: number, patch: Partial<RateRow>) {
    setRateRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
    setMessage(null);
  }

  function addRateRow() {
    const used = new Set(rateRows.map((row) => row.currency));
    const next =
      availableRateCurrencies.find((code) => !used.has(code)) ??
      availableRateCurrencies[0] ??
      "USD";
    setRateRows((prev) => [...prev, { currency: next, rate: "" }]);
    setMessage(null);
  }

  function removeRateRow(index: number) {
    setRateRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
    );
    setMessage(null);
  }

  async function handleCurrencySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const exchangeRates: Record<string, number> = {};
    for (const row of rateRows) {
      const code = row.currency.trim().toUpperCase();
      const trimmed = row.rate.trim();
      if (!trimmed) continue;
      if (code === baseCurrency) continue;

      const rate = Number(trimmed);
      if (!Number.isFinite(rate) || rate <= 0) {
        setError(`Enter a positive rate for ${code}.`);
        return;
      }
      exchangeRates[code] = rate;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCurrency, exchangeRates }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        baseCurrency?: string;
        exchangeRates?: Record<string, number>;
      } | null;

      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to save settings.");
      }

      if (body?.baseCurrency) {
        setBaseCurrency(normalizeCurrencyCode(body.baseCurrency));
      }
      if (body?.exchangeRates) {
        const entries = Object.entries(body.exchangeRates);
        setRateRows(
          entries.length > 0
            ? entries.map(([currency, rate]) => ({
                currency,
                rate: String(rate),
              }))
            : [{ currency: "USD", rate: "" }],
        );
      }
      setMessage("Settings saved. New expenses will use these rates.");
      toast.success("Settings saved.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save settings.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    setProfileSaving(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        details?: Array<{ path: string; message: string }>;
        name?: string;
      } | null;
      if (!res.ok) {
        throw new Error(
          fieldError(body?.details, "name") ??
            body?.error ??
            "Failed to update display name.",
        );
      }
      setDisplayName(body?.name ?? displayName.trim());
      setProfileMessage("Display name updated.");
      toast.success("Profile updated.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update display name.";
      setProfileError(message);
      toast.error(message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordFieldErrors({});
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        details?: Array<{ path: string; message: string }>;
      } | null;
      if (!res.ok) {
        const nextErrors: Record<string, string> = {};
        for (const detail of body?.details ?? []) {
          if (detail.path) nextErrors[detail.path] = detail.message;
        }
        setPasswordFieldErrors(nextErrors);
        throw new Error(body?.error ?? "Failed to change password.");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated.");
      toast.success("Password updated.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to change password.";
      setPasswordError(message);
      toast.error(message);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleExport() {
    setExportError(null);
    setExportMessage(null);
    setExporting(true);
    try {
      await downloadCsv("expenses");
      await downloadCsv("income");
      setExportMessage("Downloaded expenses and income CSV files.");
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Failed to export data.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadBackup() {
    setBackupError(null);
    setBackupMessage(null);
    setBackupBusy(true);
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to create backup.");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename =
        match?.[1] ??
        `expense-tracker-backup-${new Date().toISOString().slice(0, 10)}.zip`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      setLastBackupAt(now);
      setBackupMessage("Backup downloaded.");
      toast.success("Backup downloaded.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create backup.";
      setBackupError(message);
      toast.error(message);
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleRestoreFile(file: File | null) {
    setRestoreError(null);
    setRestoreMessage(null);
    setRestorePreview(null);
    setRestoreFile(null);
    setReplaceModalOpen(false);
    setReplaceConfirmText("");
    if (!file) return;

    setRestoreBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/settings/backup/preview", {
        method: "POST",
        body,
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        preview?: BackupPreview;
      } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to preview backup.");
      }
      if (!payload?.preview) {
        throw new Error("Backup preview was empty.");
      }
      setRestoreFile(file);
      setRestorePreview(payload.preview);
    } catch (err) {
      setRestoreError(
        err instanceof Error ? err.message : "Failed to preview backup.",
      );
    } finally {
      setRestoreBusy(false);
    }
  }

  async function runRestore(mode: "merge" | "replace") {
    if (!restoreFile || !restorePreview) return;

    setRestoreBusy(true);
    setRestoreError(null);
    setRestoreMessage(null);
    try {
      const body = new FormData();
      body.append("file", restoreFile);
      body.append("mode", mode);
      if (mode === "replace") {
        body.append("confirmation", replaceConfirmText.trim());
      }

      const res = await fetch("/api/settings/backup/restore", {
        method: "POST",
        body,
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        counts?: {
          categories: number;
          expenses: number;
          incomes: number;
          budgets: number;
          receipts: number;
          recurringItems: number;
          wallets: number;
          transfers: number;
          goals: number;
        };
      } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to restore backup.");
      }

      const counts = payload?.counts;
      const summary = counts
        ? `Restored ${counts.categories} categories, ${counts.expenses} expenses, ${counts.incomes} income, ${counts.budgets} budgets, ${counts.recurringItems} recurring, ${counts.wallets} wallets, ${counts.transfers} transfers, ${counts.goals} goals, ${counts.receipts} receipts (${mode}).`
        : `Backup restored (${mode}).`;
      setRestoreMessage(summary);
      setRestorePreview(null);
      setRestoreFile(null);
      setReplaceModalOpen(false);
      setReplaceConfirmText("");
      await load();
      await loadCategories();
      toast.success("Backup restored.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to restore backup.";
      setRestoreError(message);
      toast.error(message);
    } finally {
      setRestoreBusy(false);
    }
  }

  const showBackupReminder = isBackupReminderDue(
    lastBackupAt ? new Date(lastBackupAt) : null,
  );

  const lastBackupLabel = lastBackupAt
    ? new Date(lastBackupAt).toLocaleString()
    : "Never";

  async function handleImportFile(file: File | null) {
    setImportError(null);
    setImportMessage(null);
    setImportPreview(null);
    if (!file) return;

    setImportBusy(true);
    try {
      const csv = await file.text();
      const res = await fetch("/api/settings/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const body = (await res.json().catch(() => null)) as
        | (ImportPreview & { error?: string })
        | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to preview import.");
      }
      setImportPreview({
        rows: body?.rows ?? [],
        validCount: body?.validCount ?? 0,
        errorCount: body?.errorCount ?? 0,
        missingCategories: body?.missingCategories ?? [],
      });
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Failed to preview import.",
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function confirmImport() {
    if (!importPreview) return;
    const validRows = importPreview.rows.filter((row) => row.status === "ok");
    if (validRows.length === 0) {
      setImportError("No valid rows to import.");
      return;
    }

    setImportBusy(true);
    setImportError(null);
    setImportMessage(null);
    try {
      const res = await fetch("/api/settings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createMissingCategories: importPreview.missingCategories.length > 0,
          rows: validRows.map((row) => ({
            date: row.date,
            description: row.description,
            category: row.category,
            amount: row.amount,
          })),
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        createdCount?: number;
        categoriesCreated?: number;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to import expenses.");
      }

      const created = body?.createdCount ?? 0;
      const categoriesCreated = body?.categoriesCreated ?? 0;
      setImportMessage(
        categoriesCreated > 0
          ? `Imported ${created} expense(s) and created ${categoriesCreated} categor${categoriesCreated === 1 ? "y" : "ies"}.`
          : `Imported ${created} expense(s).`,
      );
      setImportPreview(null);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Failed to import expenses.",
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryError(null);
    setCategoryMessage(null);

    const name = newCategoryName.trim();
    if (!name) {
      setCategoryError("Enter a category name.");
      return;
    }

    setAddingCategory(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        name?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to add category.");
      }
      setNewCategoryName("");
      setCategoryMessage(`Added “${body?.name ?? name}”.`);
      await loadCategories();
      toast.success("Category added.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add category.";
      setCategoryError(message);
      toast.error(message);
    } finally {
      setAddingCategory(false);
    }
  }

  function startRenameCategory(category: Category) {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setCategoryError(null);
    setCategoryMessage(null);
  }

  function cancelRenameCategory() {
    setEditingCategoryId(null);
    setEditingCategoryName("");
  }

  async function saveRenameCategory(categoryId: string) {
    setCategoryError(null);
    setCategoryMessage(null);

    const name = editingCategoryName.trim();
    if (!name) {
      setCategoryError("Enter a category name.");
      return;
    }

    setSavingCategoryId(categoryId);
    try {
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        name?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to rename category.");
      }
      setEditingCategoryId(null);
      setEditingCategoryName("");
      setCategoryMessage(`Renamed to “${body?.name ?? name}”.`);
      await loadCategories();
      toast.success("Category renamed.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to rename category.";
      setCategoryError(message);
      toast.error(message);
    } finally {
      setSavingCategoryId(null);
    }
  }

  async function handleDeleteCategory(category: Category) {
    const confirmed = await confirm({
      title: "Delete category?",
      description: `Delete “${category.name}”? Categories with expenses cannot be removed.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;

    setCategoryError(null);
    setCategoryMessage(null);
    setDeletingCategoryId(category.id);
    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to delete category.");
      }
      if (editingCategoryId === category.id) cancelRenameCategory();
      setCategoryMessage(`Deleted “${category.name}”.`);
      await loadCategories();
      toast.success("Category deleted.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete category.";
      setCategoryError(message);
      toast.error(message);
    } finally {
      setDeletingCategoryId(null);
    }
  }

  return (
    <AppShell
      title="Settings"
      description="Manage your profile, password, currency, categories, backup, and data import/export."
      maxWidth="2xl"
    >
      <div className="flex flex-col gap-6">
        {loading ? (
          <FormSkeleton />
        ) : (
          <>
            {showBackupReminder ? (
              <div
                className="flex gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                role="status"
              >
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                  <IconAlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {lastBackupAt
                      ? `No backup in over ${BACKUP_REMINDER_DAYS} days`
                      : "No backup yet"}
                  </p>
                  <p className="mt-1 text-amber-900/90 dark:text-amber-100/80">
                    Download a ZIP backup from the Backup section below so you
                    can restore your data if something goes wrong.
                  </p>
                </div>
              </div>
            ) : null}

            <form
              onSubmit={handleProfileSubmit}
              className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Profile
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Update the display name on your account.
                </p>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Email</span>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  Display name
                </span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    setProfileMessage(null);
                  }}
                  maxLength={80}
                  required
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              {profileError ? (
                <p className="text-sm text-expense">{profileError}</p>
              ) : null}
              {profileMessage ? (
                <p className="text-sm text-teal-700">{profileMessage}</p>
              ) : null}
              <button
                type="submit"
                disabled={profileSaving}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {profileSaving ? "Saving…" : "Save display name"}
              </button>
            </form>

            <form
              onSubmit={handlePasswordSubmit}
              className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Change password
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Enter your current password, then choose a new one.
                </p>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  Current password
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => {
                    setCurrentPassword(event.target.value);
                    setPasswordMessage(null);
                  }}
                  required
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {passwordFieldErrors.currentPassword ? (
                  <span className="text-xs text-expense">
                    {passwordFieldErrors.currentPassword}
                  </span>
                ) : null}
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  New password
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setPasswordMessage(null);
                  }}
                  required
                  minLength={8}
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {passwordFieldErrors.newPassword ? (
                  <span className="text-xs text-expense">
                    {passwordFieldErrors.newPassword}
                  </span>
                ) : null}
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  Confirm new password
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setPasswordMessage(null);
                  }}
                  required
                  minLength={8}
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {passwordFieldErrors.confirmPassword ? (
                  <span className="text-xs text-expense">
                    {passwordFieldErrors.confirmPassword}
                  </span>
                ) : null}
              </label>
              {passwordError ? (
                <p className="text-sm text-expense">{passwordError}</p>
              ) : null}
              {passwordMessage ? (
                <p className="text-sm text-teal-700">{passwordMessage}</p>
              ) : null}
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {passwordSaving ? "Updating…" : "Update password"}
              </button>
            </form>

            <form
              onSubmit={handleCurrencySubmit}
              className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Currency settings
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Choose your base currency and enter manual exchange rates.
                  Totals, budgets, and reports use the base currency.
                </p>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  Base currency
                </span>
                <select
                  value={baseCurrency}
                  onChange={(event) => {
                    setBaseCurrency(normalizeCurrencyCode(event.target.value));
                    setMessage(null);
                  }}
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Exchange rates
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Example: 1 USD = 280 {baseCurrency}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addRateRow}
                    className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline"
                  >
                    Add rate
                  </button>
                </div>

                <ul className="space-y-3">
                  {rateRows.map((row, index) => (
                    <li
                      key={`${row.currency}-${index}`}
                      className="flex flex-col gap-2 sm:flex-row sm:items-end"
                    >
                      <label className="flex flex-1 flex-col gap-1.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Currency
                        </span>
                        <select
                          value={row.currency}
                          onChange={(event) =>
                            updateRateRow(index, {
                              currency: event.target.value,
                            })
                          }
                          className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        >
                          {availableRateCurrencies.map((code) => (
                            <option key={code} value={code}>
                              {code}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-[1.2] flex-col gap-1.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          1 {row.currency || "…"} = ? {baseCurrency}
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          placeholder="280"
                          value={row.rate}
                          onChange={(event) =>
                            updateRateRow(index, { rate: event.target.value })
                          }
                          className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeRateRow(index)}
                        disabled={rateRows.length <= 1}
                        className="h-11 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {error ? <p className="text-sm text-expense">{error}</p> : null}
              {message ? (
                <p className="text-sm text-teal-700">{message}</p>
              ) : null}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save currency settings"}
              </button>
            </form>

            <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Categories
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Add, rename, or delete your categories. Names must be unique.
                  Categories that still have expenses cannot be deleted.
                </p>
              </div>

              <form
                onSubmit={handleAddCategory}
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
              >
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    New category
                  </span>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(event) => {
                      setNewCategoryName(event.target.value);
                      setCategoryError(null);
                      setCategoryMessage(null);
                    }}
                    maxLength={40}
                    placeholder="e.g. Education"
                    className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <button
                  type="submit"
                  disabled={addingCategory}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {addingCategory ? "Adding…" : "Add"}
                </button>
              </form>

              {categoryError ? (
                <p className="text-sm text-expense">{categoryError}</p>
              ) : null}
              {categoryMessage ? (
                <p className="text-sm text-teal-700">{categoryMessage}</p>
              ) : null}

              {categoriesLoading ? (
                <ListSkeleton rows={4} />
              ) : categories.length === 0 ? (
                <EmptyState
                  title="No categories yet."
                  description="Add your first one using the field above."
                />
              ) : (
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                  {categories.map((category) => {
                    const isEditing = editingCategoryId === category.id;
                    return (
                      <li
                        key={category.id}
                        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingCategoryName}
                            onChange={(event) =>
                              setEditingCategoryName(event.target.value)
                            }
                            maxLength={40}
                            className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:max-w-xs"
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium text-zinc-900">
                            {category.name}
                          </span>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void saveRenameCategory(category.id)
                                }
                                disabled={savingCategoryId === category.id}
                                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
                              >
                                {savingCategoryId === category.id
                                  ? "Saving…"
                                  : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelRenameCategory}
                                disabled={savingCategoryId === category.id}
                                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-zinc-50"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startRenameCategory(category)}
                                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-zinc-50"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteCategory(category)
                                }
                                disabled={deletingCategoryId === category.id}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                              >
                                {deletingCategoryId === category.id
                                  ? "Deleting…"
                                  : "Delete"}
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Backup
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Download a ZIP with your categories, expenses, income,
                  budgets, recurring items, currency settings, and receipt
                  files.
                </p>
              </div>
              <p className="text-sm text-zinc-600">
                Last backup:{" "}
                <span className="font-medium text-zinc-900">
                  {lastBackupLabel}
                </span>
              </p>
              {backupError ? (
                <p className="text-sm text-expense">{backupError}</p>
              ) : null}
              {backupMessage ? (
                <p className="text-sm text-teal-700">{backupMessage}</p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleDownloadBackup()}
                disabled={backupBusy}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {backupBusy ? "Preparing backup…" : "Download backup"}
              </button>
            </section>

            <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Restore
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Upload a backup ZIP (max 50 MB). Review the preview, then
                  merge into your current data or replace it entirely.
                </p>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  Backup ZIP
                </span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  disabled={restoreBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void handleRestoreFile(file);
                    event.target.value = "";
                  }}
                  className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal-800 hover:file:bg-teal-100"
                />
              </label>

              {restoreError ? (
                <p className="text-sm text-expense">{restoreError}</p>
              ) : null}
              {restoreMessage ? (
                <p className="text-sm text-teal-700">{restoreMessage}</p>
              ) : null}

              {restorePreview ? (
                <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-700">
                    Preview (format v{restorePreview.formatVersion}, created{" "}
                    {new Date(restorePreview.createdAt).toLocaleString()}):{" "}
                    {restorePreview.categories} categories,{" "}
                    {restorePreview.expenses} expenses,{" "}
                    {restorePreview.incomes} income,{" "}
                    {restorePreview.budgets} budgets,{" "}
                    {restorePreview.recurringItems} recurring,{" "}
                    {restorePreview.wallets} wallets,{" "}
                    {restorePreview.transfers} transfers,{" "}
                    {restorePreview.goals} goals,{" "}
                    {restorePreview.receipts} receipts.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={restoreBusy}
                      onClick={() => void runRestore("merge")}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {restoreBusy
                        ? "Restoring…"
                        : "Merge (keep my current data and add missing items)"}
                    </button>
                    <button
                      type="button"
                      disabled={restoreBusy}
                      onClick={() => {
                        setReplaceConfirmText("");
                        setReplaceModalOpen(true);
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Replace (delete my current data and use the backup)
                    </button>
                    <button
                      type="button"
                      disabled={restoreBusy}
                      onClick={() => {
                        setRestorePreview(null);
                        setRestoreFile(null);
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-medium text-foreground transition hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Data export
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Download all of your expenses and income as separate CSV
                  files.
                </p>
              </div>
              {exportError ? (
                <p className="text-sm text-expense">{exportError}</p>
              ) : null}
              {exportMessage ? (
                <p className="text-sm text-teal-700">{exportMessage}</p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={exporting}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? "Preparing downloads…" : "Download CSV files"}
              </button>
            </section>

            <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Data import
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Upload an expenses CSV with columns{" "}
                  <span className="font-medium text-zinc-800">
                    date, description, category, amount
                  </span>
                  . Review the preview before importing. Missing categories are
                  created only after you confirm.
                </p>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  Expenses CSV
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={importBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void handleImportFile(file);
                    event.target.value = "";
                  }}
                  className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal-800 hover:file:bg-teal-100"
                />
              </label>

              {importError ? (
                <p className="text-sm text-expense">{importError}</p>
              ) : null}
              {importMessage ? (
                <p className="text-sm text-teal-700">{importMessage}</p>
              ) : null}

              {importPreview ? (
                <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-700">
                    Preview: {importPreview.validCount} valid row
                    {importPreview.validCount === 1 ? "" : "s"},{" "}
                    {importPreview.errorCount} with errors.
                  </p>
                  {importPreview.missingCategories.length > 0 ? (
                    <p className="text-sm text-amber-800">
                      Missing categories that will be created on confirm:{" "}
                      {importPreview.missingCategories.join(", ")}
                    </p>
                  ) : null}

                  <div className="max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-white">
                    <table className="min-w-full text-left text-xs">
                      <thead className="sticky top-0 bg-zinc-100 text-zinc-600">
                        <tr>
                          <th className="px-2 py-2 font-medium">Row</th>
                          <th className="px-2 py-2 font-medium">Date</th>
                          <th className="px-2 py-2 font-medium">Description</th>
                          <th className="px-2 py-2 font-medium">Category</th>
                          <th className="px-2 py-2 font-medium">Amount</th>
                          <th className="px-2 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={
                              row.status === "error"
                                ? "bg-red-50 text-red-800"
                                : "text-zinc-800"
                            }
                          >
                            <td className="px-2 py-1.5">{row.rowNumber}</td>
                            <td className="px-2 py-1.5">{row.date || "—"}</td>
                            <td className="px-2 py-1.5">
                              {row.description || "—"}
                            </td>
                            <td className="px-2 py-1.5">
                              {row.category || "—"}
                              {row.status === "ok" && !row.categoryExists
                                ? " (new)"
                                : ""}
                            </td>
                            <td className="px-2 py-1.5">
                              {row.amount == null ? "—" : row.amount}
                            </td>
                            <td className="px-2 py-1.5">
                              {row.status === "error"
                                ? row.error ?? "Error"
                                : "OK"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={
                        importBusy || importPreview.validCount === 0
                      }
                      onClick={() => void confirmImport()}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {importBusy
                        ? "Importing…"
                        : importPreview.missingCategories.length > 0
                          ? "Confirm import & create categories"
                          : "Confirm import"}
                    </button>
                    <button
                      type="button"
                      disabled={importBusy}
                      onClick={() => setImportPreview(null)}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-medium text-foreground transition hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <Modal
              open={replaceModalOpen}
              onClose={() => {
                if (restoreBusy) return;
                setReplaceModalOpen(false);
                setReplaceConfirmText("");
              }}
              title="Replace all data?"
              description="This deletes your current categories, expenses, income, budgets, recurring items, wallets, transfers, goals, and receipts, then loads the backup. Type RESTORE to confirm."
              footer={
                <>
                  <button
                    type="button"
                    disabled={restoreBusy}
                    onClick={() => {
                      setReplaceModalOpen(false);
                      setReplaceConfirmText("");
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-medium text-foreground transition hover:bg-zinc-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      restoreBusy || replaceConfirmText.trim() !== "RESTORE"
                    }
                    onClick={() => void runRestore("replace")}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {restoreBusy ? "Restoring…" : "Replace data"}
                  </button>
                </>
              }
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  Type RESTORE
                </span>
                <input
                  type="text"
                  value={replaceConfirmText}
                  onChange={(event) =>
                    setReplaceConfirmText(event.target.value)
                  }
                  autoComplete="off"
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="RESTORE"
                />
              </label>
            </Modal>
          </>
        )}
      </div>
    </AppShell>
  );
}
