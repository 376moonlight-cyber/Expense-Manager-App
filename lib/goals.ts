import { z } from "zod";

export const goalBodySchema = z.object({
  name: z
    .string({ error: "Name must be a string" })
    .trim()
    .min(1, { message: "Name is required" })
    .max(80, { message: "Name must be at most 80 characters" }),
  targetAmount: z
    .number({ error: "Target amount must be a number" })
    .positive({ message: "Target amount must be positive" })
    .finite({ message: "Target amount must be a finite number" }),
  savedAmount: z
    .number({ error: "Saved amount must be a number" })
    .min(0, { message: "Saved amount cannot be negative" })
    .finite({ message: "Saved amount must be a finite number" })
    .optional()
    .default(0),
  deadline: z
    .union([
      z
        .string()
        .refine((value) => !Number.isNaN(Date.parse(value)), {
          message: "Deadline must be a valid date",
        }),
      z.null(),
      z.literal(""),
    ])
    .optional()
    .transform((value) => {
      if (value == null || value === "") return null;
      return value;
    }),
});

export type GoalBody = z.infer<typeof goalBodySchema>;

export const addSavingsSchema = z.object({
  amount: z
    .number({ error: "Amount must be a number" })
    .positive({ message: "Amount must be positive" })
    .finite({ message: "Amount must be a finite number" }),
});

export type AddSavingsBody = z.infer<typeof addSavingsSchema>;

/** Progress ratio 0–1+ for a savings goal. */
export function goalProgressRatio(
  savedAmountMinor: number,
  targetAmountMinor: number,
): number {
  if (targetAmountMinor <= 0) return 0;
  return savedAmountMinor / targetAmountMinor;
}
