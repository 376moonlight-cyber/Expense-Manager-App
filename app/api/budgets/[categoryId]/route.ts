import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { budgetBodySchema } from "@/lib/budgets";
import { toMinorUnits } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

type RouteContext = { params: Promise<{ categoryId: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { categoryId } = await context.params;

    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      return jsonError("Category not found.", 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonError();
    }

    const parsed = budgetBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const rawLimit = parsed.data.monthlyLimit ?? null;
    // Null or 0 clears the monthly budget for this category.
    const shouldRemove = rawLimit === null || rawLimit === 0;

    if (shouldRemove) {
      await prisma.budget.deleteMany({ where: { userId, categoryId } });
      return NextResponse.json({
        categoryId,
        categoryName: category.name,
        monthlyLimit: null,
      });
    }

    const monthlyLimitMinor = toMinorUnits(rawLimit);
    const budget = await prisma.budget.upsert({
      where: {
        userId_categoryId: { userId, categoryId },
      },
      create: { userId, categoryId, monthlyLimitMinor },
      update: { monthlyLimitMinor },
    });

    return NextResponse.json({
      categoryId,
      categoryName: category.name,
      monthlyLimit: budget.monthlyLimitMinor,
    });
  } catch (error) {
    return serverError(
      "PUT /api/budgets/[categoryId]",
      error,
      "Failed to update budget.",
    );
  }
}
