import { z } from "zod";

export const INCOME_SOURCES = [
  "Salary",
  "Freelance",
  "Gift",
  "Other",
] as const;

export type IncomeSource = (typeof INCOME_SOURCES)[number];

export const incomeBodySchema = z.object({
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
  source: z
    .string({ error: "Source must be a string" })
    .trim()
    .min(1, { message: "Source is required" })
    .max(50, { message: "Source must be at most 50 characters" }),
  description: z
    .string({ error: "Description must be a string" })
    .trim()
    .max(200, { message: "Description must be at most 200 characters" })
    .optional()
    .default(""),
  date: z
    .string({ error: "Date must be a string" })
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Date must be a valid date",
    }),
  walletId: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
});

export type IncomeBody = z.infer<typeof incomeBodySchema>;
