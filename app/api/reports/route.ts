import { NextRequest, NextResponse } from "next/server";
import { jsonError, serverError, validationError } from "@/lib/api";
import { getOrCreateSettings } from "@/lib/currency";
import {
  eachDayKeyInMonth,
  formatMinorUnits,
  lastNMonths,
  monthDateRange,
  monthQuerySchema,
  previousMonthKey,
} from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Percent of total, rounded to nearest whole number. */
function percentOfTotal(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/**
 * Percent change vs previous. `null` when previous is 0 and current > 0
 * (no meaningful baseline — treat as new spending).
 */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const monthParam = request.nextUrl.searchParams.get("month");
    const format = request.nextUrl.searchParams.get("format");

    const parsedMonth = monthQuerySchema.safeParse(monthParam);
    if (!parsedMonth.success) {
      return validationError(parsedMonth.error);
    }

    const month = parsedMonth.data;
    const range = monthDateRange(month);
    if (!range) {
      return jsonError("Invalid month.", 400);
    }

    const settings = await getOrCreateSettings(userId);

    // CSV export for the selected month (full rows needed for download only).
    if (format === "csv") {
      const rows = await prisma.expense.findMany({
        where: {
          userId,
          date: { gte: range.gte, lt: range.lt },
        },
        orderBy: { date: "asc" },
        include: { category: { select: { name: true } } },
      });

      const lines = [
        "date,description,category,amount,currency,converted_amount,base_currency,exchange_rate",
        ...rows.map((row) =>
          [
            row.date.toISOString().slice(0, 10),
            escapeCsv(row.description),
            escapeCsv(row.category.name),
            formatMinorUnits(row.amountMinor),
            row.currency,
            formatMinorUnits(row.convertedAmountMinor),
            settings.baseCurrency,
            String(row.exchangeRateUsed),
          ].join(","),
        ),
      ];

      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="expenses-${month}.csv"`,
        },
      });
    }

    const monthKeys = lastNMonths(month, 6);
    const prevMonth = previousMonthKey(month);
    const prevRange = prevMonth ? monthDateRange(prevMonth) : null;

    const [
      byCategoryGrouped,
      prevByCategoryGrouped,
      categories,
      topExpenses,
      monthlyTotals,
      selectedIncomeAgg,
      selectedExpenseAgg,
      dailyExpenseRows,
    ] = await Promise.all([
      prisma.expense.groupBy({
        by: ["categoryId"],
        where: {
          userId,
          date: { gte: range.gte, lt: range.lt },
        },
        _sum: { convertedAmountMinor: true },
        orderBy: { _sum: { convertedAmountMinor: "desc" } },
      }),
      prevRange
        ? prisma.expense.groupBy({
            by: ["categoryId"],
            where: {
              userId,
              date: { gte: prevRange.gte, lt: prevRange.lt },
            },
            _sum: { convertedAmountMinor: true },
          })
        : Promise.resolve(
            [] as Array<{
              categoryId: string;
              _sum: { convertedAmountMinor: number | null };
            }>,
          ),
        prisma.category.findMany({
          where: { userId },
          select: { id: true, name: true },
        }),
      prisma.expense.findMany({
        where: {
          userId,
          date: { gte: range.gte, lt: range.lt },
        },
        orderBy: { convertedAmountMinor: "desc" },
        take: 5,
        include: { category: { select: { name: true } } },
      }),
      // Income vs expenses per month — one Prisma aggregate pair each (no raw rows).
      Promise.all(
        monthKeys.map(async (key) => {
          const window = monthDateRange(key)!;
          const [expenseResult, incomeResult] = await Promise.all([
            prisma.expense.aggregate({
              where: {
                userId,
                date: { gte: window.gte, lt: window.lt },
              },
              _sum: { convertedAmountMinor: true },
            }),
            prisma.income.aggregate({
              where: {
                userId,
                date: { gte: window.gte, lt: window.lt },
              },
              _sum: { convertedAmountMinor: true },
            }),
          ]);
          return {
            month: key,
            income: incomeResult._sum.convertedAmountMinor ?? 0,
            expenses: expenseResult._sum.convertedAmountMinor ?? 0,
          };
        }),
      ),
      prisma.income.aggregate({
        where: {
          userId,
          date: { gte: range.gte, lt: range.lt },
        },
        _sum: { convertedAmountMinor: true },
      }),
      prisma.expense.aggregate({
        where: {
          userId,
          date: { gte: range.gte, lt: range.lt },
        },
        _sum: { convertedAmountMinor: true },
      }),
      // Only date + amount for daily bucketing on the server (never sent to the client).
      prisma.expense.findMany({
        where: {
          userId,
          date: { gte: range.gte, lt: range.lt },
        },
        select: {
          date: true,
          convertedAmountMinor: true,
        },
      }),
    ]);

    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    const prevTotalByCategory = new Map(
      prevByCategoryGrouped.map((row) => [
        row.categoryId,
        row._sum.convertedAmountMinor ?? 0,
      ]),
    );

    const expenseTotal = selectedExpenseAgg._sum.convertedAmountMinor ?? 0;
    const incomeTotal = selectedIncomeAgg._sum.convertedAmountMinor ?? 0;

    const byCategory = byCategoryGrouped.map((row) => {
      const total = row._sum.convertedAmountMinor ?? 0;
      const previousTotal = prevTotalByCategory.get(row.categoryId) ?? 0;
      return {
        categoryId: row.categoryId,
        category: categoryNameById.get(row.categoryId) ?? "Unknown",
        total,
        percentage: percentOfTotal(total, expenseTotal),
        previousTotal,
        changePercent: percentChange(total, previousTotal),
      };
    });

    // Fill every calendar day so the line chart has a continuous x-axis.
    const dailyTotals = new Map<string, number>();
    for (const row of dailyExpenseRows) {
      const day = row.date.toISOString().slice(0, 10);
      dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + row.convertedAmountMinor);
    }
    const dailySpending = eachDayKeyInMonth(month).map((day) => ({
      date: day,
      total: dailyTotals.get(day) ?? 0,
    }));

    const savingsRate =
      incomeTotal > 0
        ? Math.round(((incomeTotal - expenseTotal) / incomeTotal) * 1000) / 10
        : null;

    return NextResponse.json({
      month,
      baseCurrency: settings.baseCurrency,
      byCategory,
      byMonth: monthlyTotals,
      dailySpending,
      savings: {
        income: incomeTotal,
        expenses: expenseTotal,
        rate: savingsRate,
      },
      topExpenses: topExpenses.map((expense) => ({
        id: expense.id,
        date: expense.date.toISOString(),
        description: expense.description,
        category: expense.category.name,
        amount: expense.convertedAmountMinor,
        originalAmount: expense.amountMinor,
        currency: expense.currency,
      })),
    });
  } catch (error) {
    return serverError("GET /api/reports", error, "Failed to load reports.");
  }
}
