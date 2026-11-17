import { z } from "zod";
import { getOrCreateSettings } from "@/lib/currency";
import { monthDateRange } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

export const recurringBodySchema = z.object({
  amount: z
    .number({ error: "Amount must be a number" })
    .positive({ message: "Amount must be positive" })
    .finite({ message: "Amount must be a finite number" }),
  description: z
    .string({ error: "Description must be a string" })
    .trim()
    .min(1, { message: "Description is required" })
    .max(200, { message: "Description must be at most 200 characters" }),
  categoryId: z
    .string({ error: "Category ID must be a string" })
    .min(1, { message: "Category ID is required" }),
  dayOfMonth: z
    .number({ error: "Day of month must be a number" })
    .int({ message: "Day of month must be an integer" })
    .min(1, { message: "Day of month must be between 1 and 28" })
    .max(28, { message: "Day of month must be between 1 and 28" }),
});

export const recurringActiveSchema = z.object({
  active: z.boolean({ error: "Active must be a boolean" }),
});

export type RecurringBody = z.infer<typeof recurringBodySchema>;

export type RecurringItemLike = {
  id: string;
  active: boolean;
  lastGeneratedMonth: string | null;
};

/** Whether this recurring item still needs an expense for `month`. */
export function needsGenerationForMonth(
  item: RecurringItemLike,
  month: string,
  alreadyGeneratedIds: ReadonlySet<string> = new Set(),
): boolean {
  if (!item.active) return false;
  if (item.lastGeneratedMonth === month) return false;
  if (alreadyGeneratedIds.has(item.id)) return false;
  return true;
}

/** Pick active items that have not yet generated for `month`. */
export function selectRecurringToGenerate<T extends RecurringItemLike>(
  items: T[],
  month: string,
  alreadyGeneratedIds: ReadonlySet<string> = new Set(),
): T[] {
  return items.filter((item) =>
    needsGenerationForMonth(item, month, alreadyGeneratedIds),
  );
}

/** UTC date for a recurring charge in YYYY-MM. */
export function expenseDateForMonth(month: string, dayOfMonth: number): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    throw new Error(`Invalid month: ${month}`);
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Math.min(Math.max(dayOfMonth, 1), 28);
  return new Date(Date.UTC(year, monthIndex, day));
}

export type RecurringStore = {
  listActive(userId: string): Promise<
    Array<{
      id: string;
      amountMinor: number;
      description: string;
      categoryId: string;
      dayOfMonth: number;
      active: boolean;
      lastGeneratedMonth: string | null;
    }>
  >;
  listGeneratedRecurringIds(
    userId: string,
    month: string,
  ): Promise<Set<string>>;
  /**
   * Atomically claim + create one expense for the month.
   * Returns true when a new expense was created, false when skipped.
   */
  claimAndCreate(input: {
    userId: string;
    month: string;
    item: {
      id: string;
      amountMinor: number;
      description: string;
      categoryId: string;
      dayOfMonth: number;
    };
  }): Promise<boolean>;
};

/** In-memory store used by unit tests to prove no-duplicate generation. */
export function createMemoryRecurringStore(
  seed: Array<{
    id: string;
    amountMinor: number;
    description: string;
    categoryId: string;
    dayOfMonth: number;
    active: boolean;
    lastGeneratedMonth: string | null;
    userId: string;
  }> = [],
): RecurringStore & {
  expenses: Array<{
    id: string;
    userId: string;
    recurringExpenseId: string;
    amountMinor: number;
    description: string;
    categoryId: string;
    date: Date;
    month: string;
  }>;
  items: typeof seed;
} {
  const items = seed.map((item) => ({ ...item }));
  const expenses: Array<{
    id: string;
    userId: string;
    recurringExpenseId: string;
    amountMinor: number;
    description: string;
    categoryId: string;
    date: Date;
    month: string;
  }> = [];
  let expenseSeq = 0;

  return {
    items,
    expenses,
    async listActive(userId) {
      return items.filter((item) => item.userId === userId && item.active);
    },
    async listGeneratedRecurringIds(userId, month) {
      return new Set(
        expenses
          .filter((e) => e.userId === userId && e.month === month)
          .map((e) => e.recurringExpenseId),
      );
    },
    async claimAndCreate({ userId, month, item }) {
      const current = items.find((row) => row.id === item.id);
      if (!current || !current.active || current.lastGeneratedMonth === month) {
        return false;
      }
      if (
        expenses.some(
          (e) =>
            e.userId === userId &&
            e.recurringExpenseId === item.id &&
            e.month === month,
        )
      ) {
        current.lastGeneratedMonth = month;
        return false;
      }

      current.lastGeneratedMonth = month;
      expenseSeq += 1;
      expenses.push({
        id: `exp_${expenseSeq}`,
        userId,
        recurringExpenseId: item.id,
        amountMinor: item.amountMinor,
        description: item.description,
        categoryId: item.categoryId,
        date: expenseDateForMonth(month, item.dayOfMonth),
        month,
      });
      return true;
    },
  };
}

const prismaRecurringStore: RecurringStore = {
  async listActive(userId) {
    return prisma.recurringExpense.findMany({
      where: { userId, active: true },
    });
  },
  async listGeneratedRecurringIds(userId, month) {
    const range = monthDateRange(month);
    if (!range) return new Set();

    const rows = await prisma.expense.findMany({
      where: {
        userId,
        recurringExpenseId: { not: null },
        date: { gte: range.gte, lt: range.lt },
      },
      select: { recurringExpenseId: true },
    });

    return new Set(
      rows
        .map((row) => row.recurringExpenseId)
        .filter((id): id is string => Boolean(id)),
    );
  },
  async claimAndCreate({ userId, month, item }) {
    const range = monthDateRange(month);
    if (!range) return false;

    const settings = await getOrCreateSettings(userId);

    return prisma.$transaction(async (tx) => {
      const claimed = await tx.recurringExpense.updateMany({
        where: {
          id: item.id,
          userId,
          active: true,
          OR: [
            { lastGeneratedMonth: null },
            { lastGeneratedMonth: { not: month } },
          ],
        },
        data: { lastGeneratedMonth: month },
      });

      if (claimed.count === 0) {
        return false;
      }

      const existing = await tx.expense.findFirst({
        where: {
          userId,
          recurringExpenseId: item.id,
          date: { gte: range.gte, lt: range.lt },
        },
        select: { id: true },
      });

      if (existing) {
        return false;
      }

      await tx.expense.create({
        data: {
          amountMinor: item.amountMinor,
          currency: settings.baseCurrency,
          convertedAmountMinor: item.amountMinor,
          exchangeRateUsed: 1,
          description: item.description,
          date: expenseDateForMonth(month, item.dayOfMonth),
          categoryId: item.categoryId,
          userId,
          recurringExpenseId: item.id,
        },
      });

      return true;
    });
  },
};

/**
 * Generate missing expenses for active recurring items for `month`.
 * Safe to call repeatedly — never creates duplicates for the same item/month.
 */
export async function generateRecurringExpensesForMonth(
  userId: string,
  month: string,
  store: RecurringStore = prismaRecurringStore,
): Promise<number> {
  if (!monthDateRange(month)) return 0;

  const [items, alreadyGeneratedIds] = await Promise.all([
    store.listActive(userId),
    store.listGeneratedRecurringIds(userId, month),
  ]);

  const todo = selectRecurringToGenerate(items, month, alreadyGeneratedIds);
  let created = 0;

  for (const item of todo) {
    const didCreate = await store.claimAndCreate({
      userId,
      month,
      item: {
        id: item.id,
        amountMinor: item.amountMinor,
        description: item.description,
        categoryId: item.categoryId,
        dayOfMonth: item.dayOfMonth,
      },
    });
    if (didCreate) created += 1;
  }

  return created;
}
