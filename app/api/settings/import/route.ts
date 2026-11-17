import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import {
  ensureDefaultCategories,
  findUserCategoryByName,
  normalizeCategoryName,
} from "@/lib/categories";
import {
  convertToBaseMinor,
  getOrCreateSettings,
  resolveExchangeRate,
} from "@/lib/currency";
import { importConfirmBodySchema } from "@/lib/csv";
import { toMinorUnits } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonError();
    }

    const parsed = importConfirmBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { rows, createMissingCategories } = parsed.data;
    await ensureDefaultCategories(userId);

    const settings = await getOrCreateSettings(userId);
    const exchangeRateUsed = resolveExchangeRate(
      settings.baseCurrency,
      settings.baseCurrency,
      settings.exchangeRates,
    );
    if (exchangeRateUsed == null) {
      return jsonError("Could not resolve base currency exchange rate.", 500);
    }

    const categoryIdByName = new Map<string, string>();
    const existing = await prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    for (const category of existing) {
      categoryIdByName.set(category.name.toLowerCase(), category.id);
    }

    const missingNames = new Set<string>();
    for (const row of rows) {
      const key = row.category.toLowerCase();
      if (!categoryIdByName.has(key)) {
        missingNames.add(row.category);
      }
    }

    if (missingNames.size > 0 && !createMissingCategories) {
      return jsonError(
        `Missing categories: ${[...missingNames].sort().join(", ")}. Confirm creation to continue.`,
        400,
      );
    }

    if (missingNames.size > 0 && createMissingCategories) {
      for (const name of missingNames) {
        const normalized = normalizeCategoryName(name);
        const found = await findUserCategoryByName(userId, normalized);
        if (found) {
          categoryIdByName.set(found.name.toLowerCase(), found.id);
          continue;
        }
        const created = await prisma.category.create({
          data: { name: normalized, userId },
        });
        categoryIdByName.set(created.name.toLowerCase(), created.id);
      }
    }

    let createdCount = 0;
    const rowErrors: Array<{ index: number; message: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]!;
      const categoryId = categoryIdByName.get(row.category.toLowerCase());
      if (!categoryId) {
        rowErrors.push({
          index,
          message: `Category "${row.category}" was not created.`,
        });
        continue;
      }

      const amountMinor = toMinorUnits(row.amount);
      await prisma.expense.create({
        data: {
          amountMinor,
          currency: settings.baseCurrency,
          convertedAmountMinor: convertToBaseMinor(
            amountMinor,
            exchangeRateUsed,
          ),
          exchangeRateUsed,
          description: row.description,
          date: new Date(row.date),
          categoryId,
          userId,
        },
      });
      createdCount += 1;
    }

    if (createdCount === 0) {
      return jsonError("No expenses were imported.", 400, [
        ...rowErrors.map((err) => ({
          path: `rows.${err.index}`,
          message: err.message,
        })),
      ]);
    }

    return NextResponse.json({
      createdCount,
      categoriesCreated: createMissingCategories ? missingNames.size : 0,
      errors: rowErrors,
    });
  } catch (error) {
    return serverError(
      "POST /api/settings/import",
      error,
      "Failed to import expenses.",
    );
  }
}
