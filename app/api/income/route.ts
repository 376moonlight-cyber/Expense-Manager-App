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
import { monthDateRange, toMinorUnits } from "@/lib/expenses";
import { incomeBodySchema } from "@/lib/income";
import { prisma } from "@/lib/prisma";
import { generateRecurringExpensesForMonth } from "@/lib/recurring";
import { requireUserId } from "@/lib/session";
import { findUserWallet } from "@/lib/wallets";

/** Keep `amountMinor` and expose API alias `amount` (original currency). */
function serializeIncome<T extends { amountMinor: number }>(income: T) {
  return {
    ...income,
    amount: income.amountMinor,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { searchParams } = request.nextUrl;
    const month = searchParams.get("month");

    const where: Prisma.IncomeWhereInput = { userId };

    if (month) {
      const range = monthDateRange(month);
      if (!range) {
        return jsonError("Invalid month. Expected format YYYY-MM.", 400);
      }
      // Materialize active recurring income exactly once per month.
      await generateRecurringExpensesForMonth(userId, month);
      where.date = { gte: range.gte, lt: range.lt };
    }

    const incomes = await prisma.income.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(incomes.map(serializeIncome));
  } catch (error) {
    return serverError("GET /api/income", error, "Failed to list income.");
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

    const parsed = incomeBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { amount, currency, source, description, date, walletId } =
      parsed.data;

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
    const income = await prisma.income.create({
      data: {
        amountMinor,
        currency,
        convertedAmountMinor: convertToBaseMinor(amountMinor, exchangeRateUsed),
        exchangeRateUsed,
        source,
        description,
        date: new Date(date),
        userId,
        walletId,
      },
    });

    return NextResponse.json(serializeIncome(income), { status: 201 });
  } catch (error) {
    return serverError("POST /api/income", error, "Failed to create income.");
  }
}
