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
import { toMinorUnits } from "@/lib/expenses";
import { incomeBodySchema } from "@/lib/income";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { findUserWallet } from "@/lib/wallets";

type RouteContext = { params: Promise<{ id: string }> };

function serializeIncome<T extends { amountMinor: number }>(income: T) {
  return {
    ...income,
    amount: income.amountMinor,
  };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const existing = await prisma.income.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return jsonError("Income not found.", 404);
    }

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
    const income = await prisma.income.update({
      where: { id },
      data: {
        amountMinor,
        currency,
        convertedAmountMinor: convertToBaseMinor(amountMinor, exchangeRateUsed),
        exchangeRateUsed,
        source,
        description,
        date: new Date(date),
        walletId,
      },
    });

    return NextResponse.json(serializeIncome(income));
  } catch (error) {
    return serverError(
      "PUT /api/income/[id]",
      error,
      "Failed to update income.",
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const existing = await prisma.income.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return jsonError("Income not found.", 404);
    }

    await prisma.income.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(
      "DELETE /api/income/[id]",
      error,
      "Failed to delete income.",
    );
  }
}
