import { describe, expect, it } from "vitest";
import {
  createMemoryRecurringStore,
  expenseDateForMonth,
  generateRecurringExpensesForMonth,
  isOccurrenceInRange,
  needsGenerationForMonth,
  nextDueDate,
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

  it("accepts a valid expense body", () => {
    expect(recurringBodySchema.safeParse(valid).success).toBe(true);
  });

  it("defaults type to EXPENSE", () => {
    const parsed = recurringBodySchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.type).toBe("EXPENSE");
  });

  it("accepts INCOME without a category", () => {
    const parsed = recurringBodySchema.safeParse({
      amount: 80_000,
      description: "Salary",
      type: "INCOME",
      dayOfMonth: 1,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects EXPENSE without a category", () => {
    expect(
      recurringBodySchema.safeParse({
        amount: 1200,
        description: "Rent",
        type: "EXPENSE",
        dayOfMonth: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects dayOfMonth outside 1–28", () => {
    expect(
      recurringBodySchema.safeParse({ ...valid, dayOfMonth: 29 }).success,
    ).toBe(false);
    expect(
      recurringBodySchema.safeParse({ ...valid, dayOfMonth: 0 }).success,
    ).toBe(false);
  });

  it("rejects endDate before startDate", () => {
    expect(
      recurringBodySchema.safeParse({
        ...valid,
        startDate: "2026-12-01",
        endDate: "2026-01-01",
      }).success,
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

  it("skips items that already have an entry for the month", () => {
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

  it("skips months outside start/end range", () => {
    expect(
      needsGenerationForMonth(
        {
          id: "r1",
          active: true,
          lastGeneratedMonth: null,
          dayOfMonth: 1,
          startDate: new Date(Date.UTC(2026, 11, 1)),
          endDate: new Date(Date.UTC(2027, 10, 1)),
        },
        "2026-11",
      ),
    ).toBe(false);
    expect(
      needsGenerationForMonth(
        {
          id: "r1",
          active: true,
          lastGeneratedMonth: null,
          dayOfMonth: 1,
          startDate: new Date(Date.UTC(2026, 11, 1)),
          endDate: new Date(Date.UTC(2027, 10, 1)),
        },
        "2026-12",
      ),
    ).toBe(true);
  });
});

describe("isOccurrenceInRange", () => {
  it("allows open-ended ranges", () => {
    expect(isOccurrenceInRange("2026-11", 5, null, null)).toBe(true);
  });

  it("enforces inclusive start and end dates", () => {
    expect(
      isOccurrenceInRange(
        "2026-11",
        1,
        new Date(Date.UTC(2026, 10, 1)),
        new Date(Date.UTC(2026, 10, 1)),
      ),
    ).toBe(true);
    expect(
      isOccurrenceInRange(
        "2026-12",
        1,
        new Date(Date.UTC(2026, 10, 1)),
        new Date(Date.UTC(2026, 10, 1)),
      ),
    ).toBe(false);
  });
});

describe("expenseDateForMonth", () => {
  it("builds a UTC date on the charge day", () => {
    expect(expenseDateForMonth("2026-11", 5).toISOString()).toBe(
      "2026-11-05T00:00:00.000Z",
    );
  });
});

describe("nextDueDate", () => {
  it("returns null when paused", () => {
    expect(
      nextDueDate(
        {
          active: false,
          dayOfMonth: 5,
          lastGeneratedMonth: null,
        },
        new Date(Date.UTC(2026, 10, 3)),
      ),
    ).toBeNull();
  });

  it("returns this month when not yet generated", () => {
    expect(
      nextDueDate(
        {
          active: true,
          dayOfMonth: 5,
          lastGeneratedMonth: null,
        },
        new Date(Date.UTC(2026, 10, 3)),
      ),
    ).toBe("2026-11-05");
  });

  it("returns next month when already generated this month", () => {
    expect(
      nextDueDate(
        {
          active: true,
          dayOfMonth: 5,
          lastGeneratedMonth: "2026-11",
        },
        new Date(Date.UTC(2026, 10, 20)),
      ),
    ).toBe("2026-12-05");
  });

  it("respects end date for installments", () => {
    expect(
      nextDueDate(
        {
          active: true,
          dayOfMonth: 1,
          startDate: new Date(Date.UTC(2026, 0, 1)),
          endDate: new Date(Date.UTC(2026, 10, 1)),
          lastGeneratedMonth: "2026-11",
        },
        new Date(Date.UTC(2026, 10, 15)),
      ),
    ).toBeNull();
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

  it("creates income entries for INCOME type", async () => {
    const store = createMemoryRecurringStore([
      {
        id: "salary",
        userId: "u1",
        amountMinor: 200_000,
        description: "Salary",
        type: "INCOME",
        categoryId: null,
        dayOfMonth: 1,
        active: true,
        lastGeneratedMonth: null,
      },
      {
        id: "rent",
        userId: "u1",
        amountMinor: 50_000,
        description: "Rent",
        type: "EXPENSE",
        categoryId: "housing",
        dayOfMonth: 1,
        active: true,
        lastGeneratedMonth: null,
      },
    ]);

    const created = await generateRecurringExpensesForMonth(
      "u1",
      "2026-11",
      store,
    );

    expect(created).toBe(2);
    expect(store.incomes).toHaveLength(1);
    expect(store.incomes[0]?.recurringExpenseId).toBe("salary");
    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]?.recurringExpenseId).toBe("rent");
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

  it("never creates duplicate incomes when called repeatedly", async () => {
    const store = createMemoryRecurringStore([
      {
        id: "salary",
        userId: "u1",
        amountMinor: 200_000,
        description: "Salary",
        type: "INCOME",
        categoryId: null,
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

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(store.incomes).toHaveLength(1);
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

  it("respects start and end dates for installment windows", async () => {
    const store = createMemoryRecurringStore([
      {
        id: "phone",
        userId: "u1",
        amountMinor: 10_000,
        description: "Phone installment",
        categoryId: "gadgets",
        dayOfMonth: 1,
        active: true,
        startDate: new Date(Date.UTC(2026, 0, 1)),
        endDate: new Date(Date.UTC(2026, 2, 1)),
        lastGeneratedMonth: null,
      },
    ]);

    expect(await generateRecurringExpensesForMonth("u1", "2025-12", store)).toBe(
      0,
    );
    expect(await generateRecurringExpensesForMonth("u1", "2026-01", store)).toBe(
      1,
    );
    expect(await generateRecurringExpensesForMonth("u1", "2026-02", store)).toBe(
      1,
    );
    expect(await generateRecurringExpensesForMonth("u1", "2026-03", store)).toBe(
      1,
    );
    expect(await generateRecurringExpensesForMonth("u1", "2026-04", store)).toBe(
      0,
    );
    expect(store.expenses).toHaveLength(3);
  });

  it("skips paused items until resumed", async () => {
    const store = createMemoryRecurringStore([
      {
        id: "gym",
        userId: "u1",
        amountMinor: 3_000,
        description: "Gym",
        categoryId: "health",
        dayOfMonth: 5,
        active: false,
        lastGeneratedMonth: null,
      },
    ]);

    expect(await generateRecurringExpensesForMonth("u1", "2026-11", store)).toBe(
      0,
    );
    store.items[0]!.active = true;
    expect(await generateRecurringExpensesForMonth("u1", "2026-11", store)).toBe(
      1,
    );
    expect(store.expenses).toHaveLength(1);
  });
});
