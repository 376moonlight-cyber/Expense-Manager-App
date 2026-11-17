"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CURRENCIES, DEFAULT_BASE_CURRENCY } from "@/lib/currency";

type SettingsPayload = {
  baseCurrency: string;
  exchangeRates: Record<string, number>;
};

type RateRow = {
  currency: string;
  rate: string;
};

export default function SettingsPage() {
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_BASE_CURRENCY);
  const [rateRows, setRateRows] = useState<RateRow[]>([
    { currency: "USD", rate: "" },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      setBaseCurrency(data.baseCurrency || DEFAULT_BASE_CURRENCY);

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

  useEffect(() => {
    void load();
  }, [load]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

      if (body?.baseCurrency) setBaseCurrency(body.baseCurrency);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-zinc-100 text-zinc-900">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <header>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/"
              className="font-medium text-teal-700 underline-offset-2 hover:underline"
            >
              ← Expenses
            </Link>
            <span className="text-zinc-300">/</span>
            <span className="font-medium text-zinc-900">Settings</span>
          </nav>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Currency settings
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Choose your base currency and enter manual exchange rates. Totals,
            budgets, and reports use the base currency.
          </p>
        </header>

        {loading ? (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
            Loading settings…
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Base currency
              </span>
              <select
                value={baseCurrency}
                onChange={(event) => {
                  setBaseCurrency(event.target.value);
                  setMessage(null);
                }}
                className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
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
                  <h2 className="text-sm font-medium text-zinc-700">
                    Exchange rates
                  </h2>
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
                        className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
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
                        className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
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

            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : null}
            {message ? (
              <p className="text-sm text-teal-700">{message}</p>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
