import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recurringActiveSchema } from "@/lib/recurring";
import { requireUserId } from "@/lib/session";

const recurringInclude = {
  category: true,
} as const;

type RouteContext = { params: Promise<{ id: string }> };

function serializeRecurring<T extends { amountMinor: number }>(item: T) {
  return { ...item, amount: item.amountMinor };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const existing = await prisma.recurringExpense.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return jsonError("Recurring expense not found.", 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonError();
    }

    const parsed = recurringActiveSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const item = await prisma.recurringExpense.update({
      where: { id },
      data: { active: parsed.data.active },
      include: recurringInclude,
    });

    return NextResponse.json(serializeRecurring(item));
  } catch (error) {
    return serverError(
      "PATCH /api/recurring/[id]",
      error,
      "Failed to update recurring expense.",
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const existing = await prisma.recurringExpense.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return jsonError("Recurring expense not found.", 404);
    }

    await prisma.recurringExpense.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(
      "DELETE /api/recurring/[id]",
      error,
      "Failed to delete recurring expense.",
    );
  }
}
