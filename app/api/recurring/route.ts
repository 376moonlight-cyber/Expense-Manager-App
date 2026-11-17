import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { toMinorUnits } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { recurringBodySchema } from "@/lib/recurring";
import { requireUserId } from "@/lib/session";

const recurringInclude = {
  category: true,
} as const;

function serializeRecurring<T extends { amountMinor: number }>(item: T) {
  return { ...item, amount: item.amountMinor };
}

export async function GET() {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const items = await prisma.recurringExpense.findMany({
      where: { userId },
      include: recurringInclude,
      orderBy: [{ active: "desc" }, { description: "asc" }],
    });

    return NextResponse.json(items.map(serializeRecurring));
  } catch (error) {
    return serverError(
      "GET /api/recurring",
      error,
      "Failed to list recurring expenses.",
    );
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

    const parsed = recurringBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { amount, description, categoryId, dayOfMonth } = parsed.data;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      return jsonError("Category does not exist.", 400);
    }

    const item = await prisma.recurringExpense.create({
      data: {
        amountMinor: toMinorUnits(amount),
        description,
        categoryId,
        dayOfMonth,
        userId,
        active: true,
        lastGeneratedMonth: null,
      },
      include: recurringInclude,
    });

    return NextResponse.json(serializeRecurring(item), { status: 201 });
  } catch (error) {
    return serverError(
      "POST /api/recurring",
      error,
      "Failed to create recurring expense.",
    );
  }
}
