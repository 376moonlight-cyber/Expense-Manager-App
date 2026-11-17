import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const DEFAULT_CATEGORY_NAMES = [
  "Food",
  "Transport",
  "Bills",
  "Shopping",
  "Health",
  "Other",
] as const;

export const categoryBodySchema = z.object({
  name: z
    .string({ error: "Name must be a string" })
    .trim()
    .min(1, { message: "Name is required" })
    .max(40, { message: "Name must be at most 40 characters" }),
});

export type CategoryBody = z.infer<typeof categoryBodySchema>;

/** Normalize for duplicate checks (trim + case-insensitive). */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Create the default starter categories for a new user (idempotent). */
export async function ensureDefaultCategories(userId: string) {
  const existing = await prisma.category.count({ where: { userId } });
  if (existing > 0) return;

  await prisma.category.createMany({
    data: DEFAULT_CATEGORY_NAMES.map((name) => ({ name, userId })),
  });
}

/** Find a category owned by this user (case-insensitive name match). */
export async function findUserCategoryByName(userId: string, name: string) {
  const normalized = normalizeCategoryName(name);
  const categories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  return (
    categories.find(
      (category) =>
        category.name.toLowerCase() === normalized.toLowerCase(),
    ) ?? null
  );
}
