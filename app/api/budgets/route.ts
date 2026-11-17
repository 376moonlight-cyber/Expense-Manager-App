import { NextRequest, NextResponse } from "next/server";
import { jsonError, serverError } from "@/lib/api";
import type { BudgetRow } from "@/lib/budgets";
import { monthDateRange } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { generateRecurringExpensesForMonth } from "@/lib/recurring";
import { requireUserId } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const month = request.nextUrl.searchParams.get("month");
    if (!month) {
      return jsonError("Query param month=YYYY-MM is required.", 400);
    }

    const range = monthDateRange(month);
    if (!range) {
      return jsonError("Invalid month. Expected format YYYY-MM.", 400);
    }

    // Keep budget spend in sync with auto-generated recurring expenses.
    await generateRecurringExpensesForMonth(userId, month);

    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        budgets: {
          where: { userId },
          take: 1,
        },
      },
    });

    const spentByCategory = await prisma.expense.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        date: { gte: range.gte, lt: range.lt },
      },
      _sum: { convertedAmountMinor: true },
    });

    const spentMap = new Map(
      spentByCategory.map((row) => [
        row.categoryId,
        row._sum.convertedAmountMinor ?? 0,
      ]),
    );

    const budgets: BudgetRow[] = categories.map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      monthlyLimit: category.budgets[0]?.monthlyLimitMinor ?? null,
      spent: spentMap.get(category.id) ?? 0,
    }));

    return NextResponse.json(budgets);
  } catch (error) {
    return serverError("GET /api/budgets", error, "Failed to list budgets.");
  }
}
