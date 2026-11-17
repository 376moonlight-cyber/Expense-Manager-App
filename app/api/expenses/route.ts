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
  normalizeTags,
  toMinorUnits,
} from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { generateRecurringExpensesForMonth } from "@/lib/recurring";
import { requireUserId } from "@/lib/session";
import { findUserWallet } from "@/lib/wallets";

const expenseInclude = {
  category: true,
  receipt: true,
} as const;

/** Keep `amountMinor` and expose API alias `amount` (original currency). */
function serializeExpense<
  T extends {
    amountMinor: number;
    tags: unknown;
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
  const { receipt, tags, ...rest } = expense;
  return {
    ...rest,
    amount: expense.amountMinor,
    tags: normalizeTags(tags),
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
    const paymentMethod = searchParams.get("paymentMethod");
    const tag = searchParams.get("tag")?.trim().toLowerCase() ?? "";
    const q = searchParams.get("q")?.trim() ?? "";
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");
    const minAmount = searchParams.get("minAmount");
    const maxAmount = searchParams.get("maxAmount");

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

    if (dateFrom || dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {
        ...(typeof where.date === "object" && where.date !== null
          ? (where.date as Prisma.DateTimeFilter)
          : {}),
      };
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (Number.isNaN(from.getTime())) {
          return jsonError("Invalid from date.", 400);
        }
        dateFilter.gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        if (Number.isNaN(to.getTime())) {
          return jsonError("Invalid to date.", 400);
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
          to.setUTCHours(23, 59, 59, 999);
        }
        dateFilter.lte = to;
      }
      where.date = dateFilter;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (q) {
      where.description = { contains: q };
    }

    if (minAmount != null && minAmount !== "") {
      const min = Number(minAmount);
      if (!Number.isFinite(min) || min < 0) {
        return jsonError("Invalid minAmount.", 400);
      }
      where.convertedAmountMinor = {
        ...((where.convertedAmountMinor as Prisma.IntFilter) ?? {}),
        gte: toMinorUnits(min),
      };
    }

    if (maxAmount != null && maxAmount !== "") {
      const max = Number(maxAmount);
      if (!Number.isFinite(max) || max < 0) {
        return jsonError("Invalid maxAmount.", 400);
      }
      where.convertedAmountMinor = {
        ...((where.convertedAmountMinor as Prisma.IntFilter) ?? {}),
        lte: toMinorUnits(max),
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    const serialized = expenses.map(serializeExpense);
    const filtered = tag
      ? serialized.filter((expense) =>
          expense.tags.some((t) => t.toLowerCase() === tag),
        )
      : serialized;

    return NextResponse.json(filtered);
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

    const {
      amount,
      currency,
      description,
      date,
      categoryId,
      paymentMethod,
      notes,
      tags,
      walletId,
    } = parsed.data;

    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      return jsonError("Category does not exist.", 400);
    }

    if (walletId) {
      const wallet = await findUserWallet(userId, walletId);
      if (!wallet) {
        return jsonError("Wallet does not exist.", 400);
      }
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
        paymentMethod,
        notes,
        tags,
        walletId,
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
