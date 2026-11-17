import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { toMinorUnits } from "@/lib/expenses";
import { listWalletsWithBalances, walletTransferSchema } from "@/lib/wallets";
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

    const parsed = walletTransferSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { fromWalletId, toWalletId, amount, note, date } = parsed.data;

    if (fromWalletId === toWalletId) {
      return jsonError("Choose two different wallets.", 400);
    }

    const [fromWallet, toWallet] = await Promise.all([
      prisma.wallet.findFirst({ where: { id: fromWalletId, userId } }),
      prisma.wallet.findFirst({ where: { id: toWalletId, userId } }),
    ]);

    if (!fromWallet || !toWallet) {
      return jsonError("One or both wallets were not found.", 400);
    }

    const amountMinor = toMinorUnits(amount);

    const transfer = await prisma.walletTransfer.create({
      data: {
        userId,
        fromWalletId,
        toWalletId,
        amountMinor,
        note,
        date: date ? new Date(date) : new Date(),
      },
    });

    const wallets = await listWalletsWithBalances(userId);

    return NextResponse.json(
      {
        transfer: {
          id: transfer.id,
          fromWalletId: transfer.fromWalletId,
          toWalletId: transfer.toWalletId,
          amountMinor: transfer.amountMinor,
          note: transfer.note,
          date: transfer.date,
          createdAt: transfer.createdAt,
        },
        wallets,
      },
      { status: 201 },
    );
  } catch (error) {
    return serverError(
      "POST /api/wallets/transfer",
      error,
      "Failed to transfer between wallets.",
    );
  }
}
