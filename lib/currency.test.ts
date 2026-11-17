import { describe, expect, it } from "vitest";
import {
  convertToBaseMinor,
  parseExchangeRates,
  resolveExchangeRate,
  settingsBodySchema,
} from "./currency";

describe("parseExchangeRates", () => {
  it("keeps positive finite rates keyed by uppercase codes", () => {
    expect(
      parseExchangeRates({ usd: 280, EUR: "305", bad: -1, XX: 1 }),
    ).toEqual({ USD: 280, EUR: 305 });
  });

  it("returns empty object for invalid input", () => {
    expect(parseExchangeRates(null)).toEqual({});
    expect(parseExchangeRates([])).toEqual({});
  });
});

describe("resolveExchangeRate", () => {
  it("returns 1 when currency matches base", () => {
    expect(resolveExchangeRate("PKR", "PKR", {})).toBe(1);
  });

  it("returns the configured rate", () => {
    expect(resolveExchangeRate("USD", "PKR", { USD: 280 })).toBe(280);
  });

  it("returns null when a foreign rate is missing", () => {
    expect(resolveExchangeRate("USD", "PKR", {})).toBeNull();
  });
});

describe("convertToBaseMinor", () => {
  it("multiplies and rounds", () => {
    expect(convertToBaseMinor(1000, 280)).toBe(280000);
    expect(convertToBaseMinor(1, 280.4)).toBe(280);
  });
});

describe("settingsBodySchema", () => {
  it("accepts base currency and rates", () => {
    const result = settingsBodySchema.safeParse({
      baseCurrency: "pkr",
      exchangeRates: { USD: 280 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.baseCurrency).toBe("PKR");
    }
  });

  it("rejects non-positive rates", () => {
    const result = settingsBodySchema.safeParse({
      baseCurrency: "PKR",
      exchangeRates: { USD: 0 },
    });
    expect(result.success).toBe(false);
  });
});
