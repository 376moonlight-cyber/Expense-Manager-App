import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { toMinorUnits } from "@/lib/expenses";
import { listWalletsWithBalances, walletBodySchema } from "@/lib/wallets";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const wallets = await listWalletsWithBalances(userId);
    return NextResponse.json(wallets);
  } catch (error) {
    return serverError("GET /api/wallets", error, "Failed to list wallets.");
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

    const parsed = walletBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { name, type, openingBalance } = parsed.data;
    const openingBalanceMinor = toMinorUnits(openingBalance);

    const wallet = await prisma.wallet.create({
      data: {
        name,
        type,
        openingBalanceMinor,
        userId,
      },
    });

    return NextResponse.json(
      {
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        openingBalanceMinor: wallet.openingBalanceMinor,
        balanceMinor: openingBalanceMinor,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
      { status: 201 },
    );
  } catch (error) {
    return serverError("POST /api/wallets", error, "Failed to create wallet.");
  }
}
