import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { currentMonthKey, toMinorUnits } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import {
  generateRecurringExpensesForMonth,
  nextDueDate,
  parseOptionalDate,
  recurringBodySchema,
} from "@/lib/recurring";
import { requireUserId } from "@/lib/session";

const recurringInclude = {
  category: true,
} as const;

function serializeRecurring<
  T extends {
    amountMinor: number;
    active: boolean;
    dayOfMonth: number;
    startDate: Date | null;
    endDate: Date | null;
    lastGeneratedMonth: string | null;
  },
>(item: T) {
  return {
    ...item,
    amount: item.amountMinor,
    nextDueDate: nextDueDate(item),
  };
}

export async function GET() {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    await generateRecurringExpensesForMonth(userId, currentMonthKey());

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
      "Failed to list recurring items.",
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

    const {
      amount,
      description,
      type,
      categoryId,
      dayOfMonth,
      startDate,
      endDate,
    } = parsed.data;

    if (type === "EXPENSE") {
      if (!categoryId) {
        return jsonError("Category is required for expenses.", 400);
      }
      const category = await prisma.category.findFirst({
        where: { id: categoryId, userId },
      });
      if (!category) {
        return jsonError("Category does not exist.", 400);
      }
    }

    const item = await prisma.recurringExpense.create({
      data: {
        amountMinor: toMinorUnits(amount),
        description,
        type,
        categoryId: type === "EXPENSE" ? categoryId! : null,
        dayOfMonth,
        startDate: parseOptionalDate(startDate),
        endDate: parseOptionalDate(endDate),
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
      "Failed to create recurring item.",
    );
  }
}
