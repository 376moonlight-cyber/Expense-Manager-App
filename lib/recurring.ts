import { z } from "zod";
import { getOrCreateSettings } from "@/lib/currency";
import { monthDateRange } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

export const RECURRING_TYPES = ["EXPENSE", "INCOME"] as const;
export type RecurringTypeValue = (typeof RECURRING_TYPES)[number];

const optionalDateString = z
  .string({ error: "Date must be a string" })
  .trim()
  .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), {
    message: "Date must be a valid date",
  })
  .optional()
  .nullable();

export const recurringBodySchema = z
  .object({
    amount: z
      .number({ error: "Amount must be a number" })
      .positive({ message: "Amount must be positive" })
      .finite({ message: "Amount must be a finite number" }),
    description: z
      .string({ error: "Description must be a string" })
      .trim()
      .min(1, { message: "Description is required" })
      .max(200, { message: "Description must be at most 200 characters" }),
    type: z.enum(RECURRING_TYPES).default("EXPENSE"),
    categoryId: z
      .string({ error: "Category ID must be a string" })
      .min(1, { message: "Category ID is required" })
      .optional()
      .nullable(),
    dayOfMonth: z
      .number({ error: "Day of month must be a number" })
      .int({ message: "Day of month must be an integer" })
      .min(1, { message: "Day of month must be between 1 and 28" })
      .max(28, { message: "Day of month must be between 1 and 28" }),
    startDate: optionalDateString,
    endDate: optionalDateString,
  })
  .superRefine((data, ctx) => {
    if (data.type === "EXPENSE" && !data.categoryId) {
      ctx.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Category is required for expenses",
      });
    }
    if (data.startDate && data.endDate) {
      const start = Date.parse(data.startDate);
      const end = Date.parse(data.endDate);
      if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "End date must be on or after start date",
        });
      }
    }
  });

export const recurringActiveSchema = z.object({
  active: z.boolean({ error: "Active must be a boolean" }),
});

export type RecurringBody = z.infer<typeof recurringBodySchema>;

export type RecurringItemLike = {
  id: string;
  active: boolean;
  lastGeneratedMonth: string | null;
  dayOfMonth?: number;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
};

/** UTC midnight for a calendar day (accepts Date or ISO-ish string). */
export function toUtcDay(value: Date | string): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
  const parsed = new Date(value);
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );
}

/** Whether the occurrence date for `month` falls within optional start/end. */
export function isOccurrenceInRange(
  month: string,
  dayOfMonth: number,
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
): boolean {
  const occurrence = expenseDateForMonth(month, dayOfMonth);
  if (startDate) {
    if (occurrence.getTime() < toUtcDay(startDate).getTime()) return false;
  }
  if (endDate) {
    if (occurrence.getTime() > toUtcDay(endDate).getTime()) return false;
  }
  return true;
}

/** Whether this recurring item still needs an entry for `month`. */
export function needsGenerationForMonth(
  item: RecurringItemLike,
  month: string,
  alreadyGeneratedIds: ReadonlySet<string> = new Set(),
): boolean {
  if (!item.active) return false;
  if (item.lastGeneratedMonth === month) return false;
  if (alreadyGeneratedIds.has(item.id)) return false;
  if (item.dayOfMonth != null) {
    if (
      !isOccurrenceInRange(
        month,
        item.dayOfMonth,
        item.startDate,
        item.endDate,
      )
    ) {
      return false;
    }
  }
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

function monthKeyFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addMonthsKey(month: string, delta: number): string {
  const range = monthDateRange(month);
  if (!range) throw new Error(`Invalid month: ${month}`);
  const next = new Date(
    Date.UTC(
      range.gte.getUTCFullYear(),
      range.gte.getUTCMonth() + delta,
      1,
    ),
  );
  return monthKeyFromDate(next);
}

/**
 * Next scheduled occurrence as ISO date (YYYY-MM-DD), or null when paused /
 * past end date / no future occurrence in range.
 */
export function nextDueDate(
  item: {
    active: boolean;
    dayOfMonth: number;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    lastGeneratedMonth: string | null;
  },
  now: Date = new Date(),
): string | null {
  if (!item.active) return null;

  let cursor = monthKeyFromDate(now);

  // If this month was already generated, start looking from next month.
  if (item.lastGeneratedMonth === cursor) {
    cursor = addMonthsKey(cursor, 1);
  }

  // Skip months before the start date's month when needed.
  if (item.startDate) {
    const startMonth = monthKeyFromDate(toUtcDay(item.startDate));
    if (cursor < startMonth) cursor = startMonth;
  }

  for (let i = 0; i < 120; i += 1) {
    if (
      isOccurrenceInRange(
        cursor,
        item.dayOfMonth,
        item.startDate,
        item.endDate,
      )
    ) {
      // Prefer a later month if this month was already generated under another key.
      if (
        item.lastGeneratedMonth &&
        item.lastGeneratedMonth >= cursor
      ) {
        cursor = addMonthsKey(cursor, 1);
        continue;
      }
      return expenseDateForMonth(cursor, item.dayOfMonth)
        .toISOString()
        .slice(0, 10);
    }
    cursor = addMonthsKey(cursor, 1);
    if (item.endDate) {
      const endMonth = monthKeyFromDate(toUtcDay(item.endDate));
      if (cursor > endMonth) return null;
    }
  }

  return null;
}

export type RecurringStoreItem = {
  id: string;
  amountMinor: number;
  description: string;
  type: RecurringTypeValue;
  categoryId: string | null;
  dayOfMonth: number;
  active: boolean;
  startDate: Date | null;
  endDate: Date | null;
  lastGeneratedMonth: string | null;
};

export type RecurringStore = {
  listActive(userId: string): Promise<RecurringStoreItem[]>;
  listGeneratedRecurringIds(
    userId: string,
    month: string,
  ): Promise<Set<string>>;
  /**
   * Atomically claim + create one expense or income for the month.
   * Returns true when a new entry was created, false when skipped.
   */
  claimAndCreate(input: {
    userId: string;
    month: string;
    item: RecurringStoreItem;
  }): Promise<boolean>;
};

/** In-memory store used by unit tests to prove no-duplicate generation. */
export function createMemoryRecurringStore(
  seed: Array<{
    id: string;
    amountMinor: number;
    description: string;
    type?: RecurringTypeValue;
    categoryId: string | null;
    dayOfMonth: number;
    active: boolean;
    startDate?: Date | null;
    endDate?: Date | null;
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
  incomes: Array<{
    id: string;
    userId: string;
    recurringExpenseId: string;
    amountMinor: number;
    description: string;
    source: string;
    date: Date;
    month: string;
  }>;
  items: Array<{
    id: string;
    amountMinor: number;
    description: string;
    type: RecurringTypeValue;
    categoryId: string | null;
    dayOfMonth: number;
    active: boolean;
    startDate: Date | null;
    endDate: Date | null;
    lastGeneratedMonth: string | null;
    userId: string;
  }>;
} {
  const items = seed.map((item) => ({
    ...item,
    type: (item.type ?? "EXPENSE") as RecurringTypeValue,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
  }));
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
  const incomes: Array<{
    id: string;
    userId: string;
    recurringExpenseId: string;
    amountMinor: number;
    description: string;
    source: string;
    date: Date;
    month: string;
  }> = [];
  let expenseSeq = 0;
  let incomeSeq = 0;

  return {
    items,
    expenses,
    incomes,
    async listActive(userId) {
      return items
        .filter((item) => item.userId === userId && item.active)
        .map((item) => ({
          id: item.id,
          amountMinor: item.amountMinor,
          description: item.description,
          type: item.type,
          categoryId: item.categoryId,
          dayOfMonth: item.dayOfMonth,
          active: item.active,
          startDate: item.startDate,
          endDate: item.endDate,
          lastGeneratedMonth: item.lastGeneratedMonth,
        }));
    },
    async listGeneratedRecurringIds(userId, month) {
      const expenseIds = expenses
        .filter((e) => e.userId === userId && e.month === month)
        .map((e) => e.recurringExpenseId);
      const incomeIds = incomes
        .filter((e) => e.userId === userId && e.month === month)
        .map((e) => e.recurringExpenseId);
      return new Set([...expenseIds, ...incomeIds]);
    },
    async claimAndCreate({ userId, month, item }) {
      const current = items.find((row) => row.id === item.id);
      if (!current || !current.active || current.lastGeneratedMonth === month) {
        return false;
      }
      if (
        !isOccurrenceInRange(
          month,
          item.dayOfMonth,
          current.startDate,
          current.endDate,
        )
      ) {
        return false;
      }
      if (
        expenses.some(
          (e) =>
            e.userId === userId &&
            e.recurringExpenseId === item.id &&
            e.month === month,
        ) ||
        incomes.some(
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
      const date = expenseDateForMonth(month, item.dayOfMonth);

      if (item.type === "INCOME") {
        incomeSeq += 1;
        incomes.push({
          id: `inc_${incomeSeq}`,
          userId,
          recurringExpenseId: item.id,
          amountMinor: item.amountMinor,
          description: item.description,
          source: item.description.slice(0, 50),
          date,
          month,
        });
      } else {
        if (!item.categoryId) return false;
        expenseSeq += 1;
        expenses.push({
          id: `exp_${expenseSeq}`,
          userId,
          recurringExpenseId: item.id,
          amountMinor: item.amountMinor,
          description: item.description,
          categoryId: item.categoryId,
          date,
          month,
        });
      }
      return true;
    },
  };
}

const prismaRecurringStore: RecurringStore = {
  async listActive(userId) {
    const rows = await prisma.recurringExpense.findMany({
      where: { userId, active: true },
    });
    return rows.map((row) => ({
      id: row.id,
      amountMinor: row.amountMinor,
      description: row.description,
      type: row.type as RecurringTypeValue,
      categoryId: row.categoryId,
      dayOfMonth: row.dayOfMonth,
      active: row.active,
      startDate: row.startDate,
      endDate: row.endDate,
      lastGeneratedMonth: row.lastGeneratedMonth,
    }));
  },
  async listGeneratedRecurringIds(userId, month) {
    const range = monthDateRange(month);
    if (!range) return new Set();

    const [expenseRows, incomeRows] = await Promise.all([
      prisma.expense.findMany({
        where: {
          userId,
          recurringExpenseId: { not: null },
          date: { gte: range.gte, lt: range.lt },
        },
        select: { recurringExpenseId: true },
      }),
      prisma.income.findMany({
        where: {
          userId,
          recurringExpenseId: { not: null },
          date: { gte: range.gte, lt: range.lt },
        },
        select: { recurringExpenseId: true },
      }),
    ]);

    return new Set(
      [...expenseRows, ...incomeRows]
        .map((row) => row.recurringExpenseId)
        .filter((id): id is string => Boolean(id)),
    );
  },
  async claimAndCreate({ userId, month, item }) {
    const range = monthDateRange(month);
    if (!range) return false;
    if (
      !isOccurrenceInRange(month, item.dayOfMonth, item.startDate, item.endDate)
    ) {
      return false;
    }

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

      if (item.type === "INCOME") {
        const existing = await tx.income.findFirst({
          where: {
            userId,
            recurringExpenseId: item.id,
            date: { gte: range.gte, lt: range.lt },
          },
          select: { id: true },
        });
        if (existing) return false;

        await tx.income.create({
          data: {
            amountMinor: item.amountMinor,
            currency: settings.baseCurrency,
            convertedAmountMinor: item.amountMinor,
            exchangeRateUsed: 1,
            source: item.description.slice(0, 50),
            description: item.description,
            date: expenseDateForMonth(month, item.dayOfMonth),
            userId,
            recurringExpenseId: item.id,
          },
        });
        return true;
      }

      if (!item.categoryId) return false;

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
 * Generate missing expenses/incomes for active recurring items for `month`.
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
      item,
    });
    if (didCreate) created += 1;
  }

  return created;
}

/** Parse optional date form fields into a Date or null. */
export function parseOptionalDate(
  value: string | null | undefined,
): Date | null {
  if (!value || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toUtcDay(parsed);
}
