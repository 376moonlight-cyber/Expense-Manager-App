import { NextRequest, NextResponse } from "next/server";
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
import { expenseBodySchema, toMinorUnits } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { deleteReceiptFile } from "@/lib/receipts";
import { requireUserId } from "@/lib/session";

const expenseInclude = {
  category: true,
  receipt: true,
} as const;

type RouteContext = { params: Promise<{ id: string }> };

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

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const existing = await prisma.expense.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return jsonError("Expense not found.", 404);
    }

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
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        amountMinor,
        currency,
        convertedAmountMinor: convertToBaseMinor(amountMinor, exchangeRateUsed),
        exchangeRateUsed,
        description,
        date: new Date(date),
        categoryId,
      },
      include: expenseInclude,
    });

    return NextResponse.json(serializeExpense(expense));
  } catch (error) {
    return serverError(
      "PUT /api/expenses/[id]",
      error,
      "Failed to update expense.",
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const existing = await prisma.expense.findFirst({
      where: { id, userId },
      include: { receipt: true },
    });
    if (!existing) {
      return jsonError("Expense not found.", 404);
    }

    const storagePath = existing.receipt?.storagePath;

    await prisma.expense.delete({ where: { id } });

    if (storagePath) {
      await deleteReceiptFile(storagePath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(
      "DELETE /api/expenses/[id]",
      error,
      "Failed to delete expense.",
    );
  }
}
