import { z } from "zod";
import { prisma } from "@/lib/prisma";

/** Currencies offered in the UI for expenses and settings. */
export const CURRENCIES = [
  "PKR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "INR",
  "SAR",
  "CAD",
  "AUD",
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const DEFAULT_BASE_CURRENCY: CurrencyCode = "PKR";

/** Coerce an API/UI string into a known currency code (falls back to default). */
export function normalizeCurrencyCode(
  value: string | null | undefined,
): CurrencyCode {
  const code = (value ?? "").trim().toUpperCase();
  return (CURRENCIES as readonly string[]).includes(code)
    ? (code as CurrencyCode)
    : DEFAULT_BASE_CURRENCY;
}

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, { message: "Currency must be a 3-letter code" });

/** exchangeRates: { USD: 280 } means 1 USD = 280 units of base currency. */
export type ExchangeRates = Record<string, number>;

export function parseExchangeRates(value: unknown): ExchangeRates {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const rates: ExchangeRates = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const code = key.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) continue;
    const rate = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    rates[code] = rate;
  }
  return rates;
}

export const settingsBodySchema = z.object({
  baseCurrency: currencyCodeSchema,
  exchangeRates: z.record(
    z.string(),
    z
      .number({ error: "Exchange rate must be a number" })
      .positive({ message: "Exchange rate must be positive" })
      .finite({ message: "Exchange rate must be a finite number" }),
  ),
});

export type SettingsBody = z.infer<typeof settingsBodySchema>;

export type UserSettings = {
  baseCurrency: string;
  exchangeRates: ExchangeRates;
};

/** Load settings for a user, creating defaults when missing. */
export async function getOrCreateSettings(
  userId: string,
): Promise<UserSettings> {
  const existing = await prisma.setting.findUnique({ where: { userId } });
  if (existing) {
    return {
      baseCurrency: existing.baseCurrency,
      exchangeRates: parseExchangeRates(existing.exchangeRates),
    };
  }

  const created = await prisma.setting.create({
    data: {
      userId,
      baseCurrency: DEFAULT_BASE_CURRENCY,
      exchangeRates: {},
    },
  });

  return {
    baseCurrency: created.baseCurrency,
    exchangeRates: {},
  };
}

/**
 * Resolve the rate used to convert `currency` → base currency.
 * Rates are stored as: 1 unit of foreign currency = N units of base.
 */
export function resolveExchangeRate(
  currency: string,
  baseCurrency: string,
  exchangeRates: ExchangeRates,
): number | null {
  const from = currency.toUpperCase();
  const base = baseCurrency.toUpperCase();

  if (from === base) return 1;

  const rate = exchangeRates[from];
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return rate;
}

/** Convert original minor units into base-currency minor units. */
export function convertToBaseMinor(
  amountMinor: number,
  rate: number,
): number {
  return Math.round(amountMinor * rate);
}
