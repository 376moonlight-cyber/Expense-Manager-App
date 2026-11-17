import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { toMinorUnits } from "@/lib/expenses";
import { listWalletsWithBalances, walletBodySchema } from "@/lib/wallets";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const existing = await prisma.wallet.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return jsonError("Wallet not found.", 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonError();
    }

    const parsed = walletBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { name, type, openingBalance } = parsed.data;

    await prisma.wallet.update({
      where: { id },
      data: {
        name,
        type,
        openingBalanceMinor: toMinorUnits(openingBalance),
      },
    });

    const wallets = await listWalletsWithBalances(userId);
    const updated = wallets.find((wallet) => wallet.id === id);
    if (!updated) {
      return jsonError("Wallet not found.", 404);
    }

    return NextResponse.json(updated);
  } catch (error) {
    return serverError(
      "PUT /api/wallets/[id]",
      error,
      "Failed to update wallet.",
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const existing = await prisma.wallet.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return jsonError("Wallet not found.", 404);
    }

    await prisma.wallet.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(
      "DELETE /api/wallets/[id]",
      error,
      "Failed to delete wallet.",
    );
  }
}
