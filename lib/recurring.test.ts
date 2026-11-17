import { describe, expect, it } from "vitest";
import {
  createMemoryRecurringStore,
  expenseDateForMonth,
  generateRecurringExpensesForMonth,
  needsGenerationForMonth,
  recurringBodySchema,
  selectRecurringToGenerate,
} from "./recurring";

describe("recurringBodySchema", () => {
  const valid = {
    amount: 1200,
    description: "Rent",
    categoryId: "cat_1",
    dayOfMonth: 1,
  };

  it("accepts a valid recurring body", () => {
    expect(recurringBodySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects dayOfMonth outside 1–28", () => {
    expect(
      recurringBodySchema.safeParse({ ...valid, dayOfMonth: 29 }).success,
    ).toBe(false);
    expect(
      recurringBodySchema.safeParse({ ...valid, dayOfMonth: 0 }).success,
    ).toBe(false);
  });
});

describe("needsGenerationForMonth / selectRecurringToGenerate", () => {
  it("skips inactive items and months already marked generated", () => {
    expect(
      needsGenerationForMonth(
        { id: "r1", active: false, lastGeneratedMonth: null },
        "2026-11",
      ),
    ).toBe(false);
    expect(
      needsGenerationForMonth(
        { id: "r1", active: true, lastGeneratedMonth: "2026-11" },
        "2026-11",
      ),
    ).toBe(false);
    expect(
      needsGenerationForMonth(
        { id: "r1", active: true, lastGeneratedMonth: "2026-10" },
        "2026-11",
      ),
    ).toBe(true);
  });

  it("skips items that already have an expense for the month", () => {
    const selected = selectRecurringToGenerate(
      [
        { id: "r1", active: true, lastGeneratedMonth: null },
        { id: "r2", active: true, lastGeneratedMonth: null },
      ],
      "2026-11",
      new Set(["r1"]),
    );
    expect(selected.map((item) => item.id)).toEqual(["r2"]);
  });
});

describe("expenseDateForMonth", () => {
  it("builds a UTC date on the charge day", () => {
    expect(expenseDateForMonth("2026-11", 5).toISOString()).toBe(
      "2026-11-05T00:00:00.000Z",
    );
  });
});

describe("generateRecurringExpensesForMonth", () => {
  it("creates exactly one expense per active item for a month", async () => {
    const store = createMemoryRecurringStore([
      {
        id: "rent",
        userId: "u1",
        amountMinor: 120_000,
        description: "Rent",
        categoryId: "housing",
        dayOfMonth: 1,
        active: true,
        lastGeneratedMonth: null,
      },
      {
        id: "netflix",
        userId: "u1",
        amountMinor: 1_500,
        description: "Netflix",
        categoryId: "subs",
        dayOfMonth: 15,
        active: true,
        lastGeneratedMonth: null,
      },
      {
        id: "paused",
        userId: "u1",
        amountMinor: 999,
        description: "Paused",
        categoryId: "subs",
        dayOfMonth: 10,
        active: false,
        lastGeneratedMonth: null,
      },
    ]);

    const created = await generateRecurringExpensesForMonth(
      "u1",
      "2026-11",
      store,
    );

    expect(created).toBe(2);
    expect(store.expenses).toHaveLength(2);
    expect(store.expenses.map((e) => e.recurringExpenseId).sort()).toEqual([
      "netflix",
      "rent",
    ]);
  });

  it("never creates duplicate expenses when called repeatedly", async () => {
    const store = createMemoryRecurringStore([
      {
        id: "rent",
        userId: "u1",
        amountMinor: 120_000,
        description: "Rent",
        categoryId: "housing",
        dayOfMonth: 1,
        active: true,
        lastGeneratedMonth: null,
      },
    ]);

    const first = await generateRecurringExpensesForMonth(
      "u1",
      "2026-11",
      store,
    );
    const second = await generateRecurringExpensesForMonth(
      "u1",
      "2026-11",
      store,
    );
    const third = await generateRecurringExpensesForMonth(
      "u1",
      "2026-11",
      store,
    );

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(third).toBe(0);
    expect(store.expenses).toHaveLength(1);
    expect(store.items[0]?.lastGeneratedMonth).toBe("2026-11");
  });

  it("generates again for a later month without duplicating the prior month", async () => {
    const store = createMemoryRecurringStore([
      {
        id: "rent",
        userId: "u1",
        amountMinor: 120_000,
        description: "Rent",
        categoryId: "housing",
        dayOfMonth: 1,
        active: true,
        lastGeneratedMonth: null,
      },
    ]);

    await generateRecurringExpensesForMonth("u1", "2026-11", store);
    await generateRecurringExpensesForMonth("u1", "2026-12", store);
    await generateRecurringExpensesForMonth("u1", "2026-11", store);
    await generateRecurringExpensesForMonth("u1", "2026-12", store);

    expect(store.expenses).toHaveLength(2);
    expect(store.expenses.filter((e) => e.month === "2026-11")).toHaveLength(1);
    expect(store.expenses.filter((e) => e.month === "2026-12")).toHaveLength(1);
  });
});
