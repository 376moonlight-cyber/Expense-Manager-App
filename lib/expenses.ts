import { z } from "zod";

export {
  formatMinorUnits,
  fromMinorUnits,
  toMinorUnits,
} from "@/lib/money";

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

/** Current UTC month as YYYY-MM. */
export function currentMonthKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
