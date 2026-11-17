"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell, SurfaceCard } from "@/components/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "@/lib/currency";
import { formatMoney, fromMinorUnits } from "@/lib/money";
import { WALLET_TYPES, type WalletType } from "@/lib/wallets";

type Wallet = {
  id: string;
  name: string;
  type: string;
  openingBalanceMinor: number;
  balanceMinor: number;
  createdAt: string;
  updatedAt: string;
};

type WalletForm = {
  name: string;
  type: WalletType;
  openingBalance: string;
};

type TransferForm = {
  fromWalletId: string;
  toWalletId: string;
  amount: string;
  note: string;
};

function emptyWalletForm(): WalletForm {
  return {
    name: "",
    type: "Cash",
    openingBalance: "0.00",
  };
}

function emptyTransferForm(wallets: Wallet[]): TransferForm {
  return {
    fromWalletId: wallets[0]?.id ?? "",
    toWalletId: wallets[1]?.id ?? wallets[0]?.id ?? "",
    amount: "",
    note: "",
  };
}

export default function WalletsPage() {
  const { confirm } = useConfirm();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_BASE_CURRENCY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<WalletForm>(emptyWalletForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<TransferForm>(emptyTransferForm([]));
  const [transferring, setTransferring] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [walletsRes, settingsRes] = await Promise.all([
        fetch("/api/wallets"),
        fetch("/api/settings"),
      ]);

      if (!walletsRes.ok) {
        const body = (await walletsRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load wallets.");
      }

      const nextWallets = (await walletsRes.json()) as Wallet[];
      const nextSettings = settingsRes.ok
        ? ((await settingsRes.json()) as { baseCurrency?: string })
        : null;

      setWallets(nextWallets);
      setBaseCurrency(normalizeCurrencyCode(nextSettings?.baseCurrency));
      setTransfer((prev) => ({
        ...prev,
        fromWalletId: prev.fromWalletId || nextWallets[0]?.id || "",
        toWalletId:
          prev.toWalletId ||
          nextWallets[1]?.id ||
          nextWallets[0]?.id ||
          "",
      }));
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
    setForm(emptyWalletForm());
  }

  function startEdit(wallet: Wallet) {
    setEditingId(wallet.id);
    setFormMessage(null);
    setForm({
      name: wallet.name,
      type: (WALLET_TYPES.includes(wallet.type as WalletType)
        ? wallet.type
        : "Cash") as WalletType,
      openingBalance: fromMinorUnits(wallet.openingBalanceMinor).toFixed(2),
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage(null);

    const openingBalance = Number(form.openingBalance);
    if (!form.name.trim()) {
      setFormMessage("Name is required.");
      return;
    }
    if (!Number.isFinite(openingBalance)) {
      setFormMessage("Enter a valid opening balance.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        editingId ? `/api/wallets/${editingId}` : "/api/wallets",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            type: form.type,
            openingBalance,
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not save wallet.");
      }

      resetForm();
      await loadData();
      toast.success(editingId ? "Wallet updated." : "Wallet added.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save wallet.";
      setFormMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(wallet: Wallet) {
    const confirmed = await confirm({
      title: "Delete wallet?",
      description: `Delete “${wallet.name}”? Linked expenses and income keep their history but lose the wallet link.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/wallets/${wallet.id}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to delete wallet.");
      }
      if (editingId === wallet.id) resetForm();
      await loadData();
      toast.success("Wallet deleted.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete wallet.";
      setError(message);
      toast.error(message);
    }
  }

  async function handleTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTransferMessage(null);

    const amount = Number(transfer.amount);
    if (!transfer.fromWalletId || !transfer.toWalletId) {
      setTransferMessage("Select both wallets.");
      return;
    }
    if (transfer.fromWalletId === transfer.toWalletId) {
      setTransferMessage("Choose two different wallets.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setTransferMessage("Enter a positive amount.");
      return;
    }

    setTransferring(true);
    try {
      const response = await fetch("/api/wallets/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWalletId: transfer.fromWalletId,
          toWalletId: transfer.toWalletId,
          amount,
          note: transfer.note.trim(),
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        wallets?: Wallet[];
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Transfer failed.");
      }

      if (body?.wallets) {
        setWallets(body.wallets);
      } else {
        await loadData();
      }
      setTransfer((prev) => ({ ...prev, amount: "", note: "" }));
      toast.success("Transfer completed.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transfer failed.";
      setTransferMessage(message);
      toast.error(message);
    } finally {
      setTransferring(false);
    }
  }

  return (
    <AppShell
      title="Wallets"
      description="Cash, bank, and card balances in one place."
      maxWidth="3xl"
    >
      <div className="flex flex-col gap-6">
        <SurfaceCard id="add-wallet">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit wallet" : "Add wallet"}
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
            <label className="flex flex-col gap-2 sm:col-span-1">
              <span className="text-sm font-medium text-foreground">Name</span>
              <input
                type="text"
                maxLength={80}
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. Everyday cash"
                className="min-h-12 rounded-xl border border-border bg-card px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="flex flex-col gap-2 sm:col-span-1">
              <span className="text-sm font-medium text-foreground">Type</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    type: event.target.value as WalletType,
                  }))
                }
                className="min-h-12 rounded-xl border border-border bg-card px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {WALLET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-foreground">
                Opening balance ({baseCurrency})
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={form.openingBalance}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    openingBalance: event.target.value,
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
                    ? "Update wallet"
                    : "Add wallet"}
              </button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="mb-4 text-lg font-semibold">Your wallets</h2>

          {loading ? (
            <ListSkeleton rows={4} />
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
          ) : wallets.length === 0 ? (
            <EmptyState
              title="No wallets yet."
              description="Add cash, bank, or mobile wallet accounts above."
              actionLabel="Add wallet"
              onAction={() =>
                document
                  .getElementById("add-wallet")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {wallets.map((wallet) => (
                <li
                  key={wallet.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate font-medium text-zinc-900">
                        {wallet.name}
                      </p>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                        {wallet.type}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      Opening{" "}
                      {formatMoney(wallet.openingBalanceMinor, baseCurrency)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p
                      className={`text-base font-semibold tabular-nums ${
                        wallet.balanceMinor >= 0
                          ? "text-zinc-900"
                          : "text-red-600"
                      }`}
                    >
                      {formatMoney(wallet.balanceMinor, baseCurrency)}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(wallet)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-zinc-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(wallet)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
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

        <SurfaceCard>
          <h2 className="mb-1 text-lg font-semibold">Transfer between wallets</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Move money from one wallet to another without creating income or
            expense.
          </p>

          <form onSubmit={handleTransfer} className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">From</span>
              <select
                value={transfer.fromWalletId}
                onChange={(event) =>
                  setTransfer((prev) => ({
                    ...prev,
                    fromWalletId: event.target.value,
                  }))
                }
                disabled={wallets.length < 2}
                className="min-h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
              >
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">To</span>
              <select
                value={transfer.toWalletId}
                onChange={(event) =>
                  setTransfer((prev) => ({
                    ...prev,
                    toWalletId: event.target.value,
                  }))
                }
                disabled={wallets.length < 2}
                className="min-h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
              >
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                Amount ({baseCurrency})
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={transfer.amount}
                onChange={(event) =>
                  setTransfer((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                disabled={wallets.length < 2}
                className="min-h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                type="text"
                maxLength={200}
                value={transfer.note}
                onChange={(event) =>
                  setTransfer((prev) => ({
                    ...prev,
                    note: event.target.value,
                  }))
                }
                disabled={wallets.length < 2}
                className="min-h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
              />
            </label>

            {transferMessage ? (
              <p className="sm:col-span-2 text-sm text-expense">
                {transferMessage}
              </p>
            ) : null}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={transferring || wallets.length < 2}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {transferring ? "Transferring…" : "Transfer"}
              </button>
            </div>
          </form>
        </SurfaceCard>
      </div>
    </AppShell>
  );
}
