import { z } from "zod";

export {
  formatMinorUnits,
  fromMinorUnits,
  toMinorUnits,
} from "@/lib/money";

export const PAYMENT_METHODS = [
  "Cash",
  "Card",
  "Bank Transfer",
  "JazzCash",
  "Easypaisa",
  "Other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "Cash";

/** Trim, drop empties, and dedupe tags (case-insensitive) while keeping first casing. */
export function parseTags(input: unknown): string[] {
  const rawParts: string[] = [];

  if (typeof input === "string") {
    rawParts.push(...input.split(","));
  } else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string") rawParts.push(item);
    }
  } else if (input == null) {
    return [];
  } else {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of rawParts) {
    const tag = part.trim();
    if (!tag) continue;
    if (tag.length > 40) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags.slice(0, 20);
}

/** Normalize Prisma Json (or unknown) into a clean string[]. */
export function normalizeTags(value: unknown): string[] {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parseTags(parsed);
    } catch {
      return parseTags(value);
    }
  }
  return parseTags(value);
}

export const expenseBodySchema = z.object({
  amount: z
    .number({ error: "Amount must be a number" })
    .positive({ message: "Amount must be positive" })
    .finite({ message: "Amount must be a finite number" }),
  currency: z
    .string({ error: "Currency must be a string" })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, { message: "Currency must be a 3-letter code" })
    .default("PKR"),
  description: z
    .string({ error: "Description must be a string" })
    .trim()
    .min(1, { message: "Description is required" })
    .max(200, { message: "Description must be at most 200 characters" }),
  date: z
    .string({ error: "Date must be a string" })
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Date must be a valid date",
    }),
  categoryId: z
    .string({ error: "Category ID must be a string" })
    .min(1, { message: "Category ID is required" }),
  paymentMethod: z
    .enum(PAYMENT_METHODS, {
      error: "Payment method is invalid",
    })
    .default(DEFAULT_PAYMENT_METHOD),
  notes: z
    .string({ error: "Notes must be a string" })
    .trim()
    .max(1000, { message: "Notes must be at most 1000 characters" })
    .optional()
    .default(""),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => parseTags(value ?? "")),
  walletId: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
});

export type ExpenseBody = z.infer<typeof expenseBodySchema>;

export const monthQuerySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, { message: "Month must be YYYY-MM" });

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/** Parse YYYY-MM into an inclusive start / exclusive end UTC range. */
export function monthDateRange(month: string): { gte: Date; lt: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;

  const gte = new Date(Date.UTC(year, monthIndex, 1));
  const lt = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { gte, lt };
}

/** Return YYYY-MM keys for `count` months ending at `endMonth` (inclusive). */
export function lastNMonths(endMonth: string, count: number): string[] {
  const range = monthDateRange(endMonth);
  if (!range) return [];

  const months: string[] = [];
  const cursor = new Date(range.gte);
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1),
    );
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months;
}

/** YYYY-MM for the month before `month`, or null if `month` is invalid. */
export function previousMonthKey(month: string): string | null {
  const range = monthDateRange(month);
  if (!range) return null;

  const d = new Date(
    Date.UTC(range.gte.getUTCFullYear(), range.gte.getUTCMonth() - 1, 1),
  );
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Every UTC calendar day (YYYY-MM-DD) in the given month. */
export function eachDayKeyInMonth(month: string): string[] {
  const range = monthDateRange(month);
  if (!range) return [];

  const days: string[] = [];
  for (
    let cursor = new Date(range.gte);
    cursor < range.lt;
    cursor = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate() + 1,
      ),
    )
  ) {
    days.push(cursor.toISOString().slice(0, 10));
  }
  return days;
}

/** Current UTC month as YYYY-MM. */
export function currentMonthKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Calendar day key YYYY-MM-DD from an ISO date string or Date. */
export function expenseDayKey(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}
