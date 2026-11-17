import { z } from "zod";

/** Body for PUT /api/budgets/[categoryId]. Null or 0 removes the budget. */
export const budgetBodySchema = z.object({
  monthlyLimit: z
    .union([
      z
        .number({ error: "Monthly limit must be a number" })
        .finite({ message: "Monthly limit must be a finite number" })
        .nonnegative({ message: "Monthly limit cannot be negative" }),
      z.null(),
    ])
    .optional(),
});

export type BudgetBody = z.infer<typeof budgetBodySchema>;

export type BudgetRow = {
  categoryId: string;
  categoryName: string;
  /** Monthly limit in minor units, or null when unset. */
  monthlyLimit: number | null;
  /** Amount spent in the requested month, in minor units. */
  spent: number;
};
