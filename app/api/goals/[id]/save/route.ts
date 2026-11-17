import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { toMinorUnits } from "@/lib/expenses";
import { addSavingsSchema } from "@/lib/goals";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const existing = await prisma.goal.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return jsonError("Goal not found.", 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonError();
    }

    const parsed = addSavingsSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const addMinor = toMinorUnits(parsed.data.amount);

    const goal = await prisma.goal.update({
      where: { id },
      data: {
        savedAmountMinor: existing.savedAmountMinor + addMinor,
      },
    });

    return NextResponse.json(goal);
  } catch (error) {
    return serverError(
      "POST /api/goals/[id]/save",
      error,
      "Failed to add savings.",
    );
  }
}
