import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { toMinorUnits } from "@/lib/expenses";
import { goalBodySchema } from "@/lib/goals";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
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

    const parsed = goalBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { name, targetAmount, savedAmount, deadline } = parsed.data;

    const goal = await prisma.goal.update({
      where: { id },
      data: {
        name,
        targetAmountMinor: toMinorUnits(targetAmount),
        savedAmountMinor: toMinorUnits(savedAmount),
        deadline: deadline ? new Date(deadline) : null,
      },
    });

    return NextResponse.json(goal);
  } catch (error) {
    return serverError("PUT /api/goals/[id]", error, "Failed to update goal.");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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

    await prisma.goal.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(
      "DELETE /api/goals/[id]",
      error,
      "Failed to delete goal.",
    );
  }
}
