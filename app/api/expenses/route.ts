import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import {
  convertToBaseMinor,
  getOrCreateSettings,
  resolveExchangeRate,
} from "@/lib/currency";
import {
  expenseBodySchema,
  monthDateRange,
  toMinorUnits,
} from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { generateRecurringExpensesForMonth } from "@/lib/recurring";
import { requireUserId } from "@/lib/session";

const expenseInclude = {
  category: true,
  receipt: true,
} as const;

/** Keep `amountMinor` and expose API alias `amount` (original currency). */
function serializeExpense<
  T extends {
    amountMinor: number;
    receipt?: {
      id: string;
      expenseId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      storagePath: string;
      createdAt: Date;
    } | null;
  },
>(expense: T) {
  const { receipt, ...rest } = expense;
  return {
    ...rest,
    amount: expense.amountMinor,
    receipt: receipt
      ? {
          id: receipt.id,
          expenseId: receipt.expenseId,
          fileName: receipt.fileName,
          mimeType: receipt.mimeType,
          sizeBytes: receipt.sizeBytes,
          createdAt: receipt.createdAt,
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { searchParams } = request.nextUrl;
    const month = searchParams.get("month");
    const categoryId = searchParams.get("categoryId");

    const where: Prisma.ExpenseWhereInput = { userId };

    if (month) {
      const range = monthDateRange(month);
      if (!range) {
        return jsonError("Invalid month. Expected format YYYY-MM.", 400);
      }
      // Materialize active recurring expenses exactly once per month.
      await generateRecurringExpensesForMonth(userId, month);
      where.date = { gte: range.gte, lt: range.lt };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(expenses.map(serializeExpense));
  } catch (error) {
    return serverError("GET /api/expenses", error, "Failed to list expenses.");
  }
}

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

    const parsed = expenseBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { amount, currency, description, date, categoryId } = parsed.data;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      return jsonError("Category does not exist.", 400);
    }

    const settings = await getOrCreateSettings(userId);
    const exchangeRateUsed = resolveExchangeRate(
      currency,
      settings.baseCurrency,
      settings.exchangeRates,
    );
    if (exchangeRateUsed == null) {
      return jsonError(
        `No exchange rate for ${currency}. Add one in Settings (1 ${currency} = ? ${settings.baseCurrency}).`,
        400,
      );
    }

    const amountMinor = toMinorUnits(amount);
    const expense = await prisma.expense.create({
      data: {
        amountMinor,
        currency,
        convertedAmountMinor: convertToBaseMinor(amountMinor, exchangeRateUsed),
        exchangeRateUsed,
        description,
        date: new Date(date),
        categoryId,
        userId,
      },
      include: expenseInclude,
    });

    return NextResponse.json(serializeExpense(expense), { status: 201 });
  } catch (error) {
    return serverError(
      "POST /api/expenses",
      error,
      "Failed to create expense.",
    );
  }
}
