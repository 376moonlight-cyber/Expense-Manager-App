import { describe, expect, it } from "vitest";
import {
  expenseBodySchema,
  formatZodError,
  eachDayKeyInMonth,
  lastNMonths,
  monthDateRange,
  parseTags,
  previousMonthKey,
  monthQuerySchema,
} from "./expenses";

describe("expenseBodySchema", () => {
  const valid = {
    amount: 12.5,
    description: "Lunch",
    date: "2026-11-16",
    categoryId: "cat_123",
  };

  it("accepts a valid expense body", () => {
    const result = expenseBodySchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("Lunch");
      expect(result.data.currency).toBe("PKR");
      expect(result.data.paymentMethod).toBe("Cash");
      expect(result.data.notes).toBe("");
      expect(result.data.tags).toEqual([]);
    }
  });

  it("accepts payment method, notes, and tags", () => {
    const result = expenseBodySchema.safeParse({
      ...valid,
      paymentMethod: "JazzCash",
      notes: " Paid at cafe ",
      tags: "food, lunch, Food",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentMethod).toBe("JazzCash");
      expect(result.data.notes).toBe("Paid at cafe");
      expect(result.data.tags).toEqual(["food", "lunch"]);
    }
  });

  it("rejects invalid payment methods", () => {
    const result = expenseBodySchema.safeParse({
      ...valid,
      paymentMethod: "Crypto",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an explicit currency", () => {
    const result = expenseBodySchema.safeParse({ ...valid, currency: "usd" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("USD");
    }
  });

  it("trims description whitespace", () => {
    const result = expenseBodySchema.safeParse({
      ...valid,
      description: "  Coffee  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("Coffee");
    }
  });

  it("rejects non-positive amounts", () => {
    const result = expenseBodySchema.safeParse({ ...valid, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = expenseBodySchema.safeParse({
      ...valid,
      description: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid dates", () => {
    const result = expenseBodySchema.safeParse({
      ...valid,
      date: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing categoryId", () => {
    const result = expenseBodySchema.safeParse({
      ...valid,
      categoryId: "",
    });
    expect(result.success).toBe(false);
  });

  it("exposes readable zod issues via formatZodError", () => {
    const result = expenseBodySchema.safeParse({
      ...valid,
      amount: -5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const details = formatZodError(result.error);
      expect(details[0]?.path).toBe("amount");
      expect(details[0]?.message.length).toBeGreaterThan(0);
    }
  });
});

describe("monthQuerySchema", () => {
  it("accepts YYYY-MM", () => {
    expect(monthQuerySchema.safeParse("2026-11").success).toBe(true);
  });

  it("rejects other formats", () => {
    expect(monthQuerySchema.safeParse("2026-1").success).toBe(false);
    expect(monthQuerySchema.safeParse("11-2026").success).toBe(false);
  });
});

describe("monthDateRange", () => {
  it("returns UTC start/end for a valid month", () => {
    const range = monthDateRange("2026-11");
    expect(range).not.toBeNull();
    expect(range?.gte.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(range?.lt.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it("returns null for invalid input", () => {
    expect(monthDateRange("2026-13")).toBeNull();
    expect(monthDateRange("bad")).toBeNull();
  });
});

describe("lastNMonths", () => {
  it("returns inclusive trailing months", () => {
    expect(lastNMonths("2026-03", 3)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });
});

describe("previousMonthKey", () => {
  it("returns the prior YYYY-MM", () => {
    expect(previousMonthKey("2026-03")).toBe("2026-02");
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });

  it("returns null for invalid input", () => {
    expect(previousMonthKey("bad")).toBeNull();
  });
});

describe("eachDayKeyInMonth", () => {
  it("lists every UTC day in the month", () => {
    const days = eachDayKeyInMonth("2026-02");
    expect(days[0]).toBe("2026-02-01");
    expect(days.at(-1)).toBe("2026-02-28");
    expect(days).toHaveLength(28);
  });
});

describe("parseTags", () => {
  it("trims, drops empties, and dedupes case-insensitively", () => {
    expect(parseTags(" food, , Lunch, FOOD ")).toEqual(["food", "Lunch"]);
  });
});
