import { NextRequest, NextResponse } from "next/server";
import { jsonError, serverError, validationError } from "@/lib/api";
import { getOrCreateSettings } from "@/lib/currency";
import {
  formatMinorUnits,
  lastNMonths,
  monthDateRange,
  monthQuerySchema,
} from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

    // Category totals via Prisma groupBy (aggregation stays on the server).
    const [byCategoryGrouped, categories, topExpenses, monthlyTotals] =
      await Promise.all([
        prisma.expense.groupBy({
          by: ["categoryId"],
          where: {
            userId,
            date: { gte: range.gte, lt: range.lt },
          },
          _sum: { convertedAmountMinor: true },
          orderBy: { _sum: { convertedAmountMinor: "desc" } },
        }),
        prisma.category.findMany({ select: { id: true, name: true } }),
        prisma.expense.findMany({
          where: {
            userId,
            date: { gte: range.gte, lt: range.lt },
          },
          orderBy: { convertedAmountMinor: "desc" },
          take: 5,
          include: { category: { select: { name: true } } },
        }),
        // One aggregate per month so we never load raw expense rows for the bar chart.
        Promise.all(
          monthKeys.map(async (key) => {
            const window = monthDateRange(key)!;
            const result = await prisma.expense.aggregate({
              where: {
                userId,
                date: { gte: window.gte, lt: window.lt },
              },
              _sum: { convertedAmountMinor: true },
            });
            return {
              month: key,
              total: result._sum.convertedAmountMinor ?? 0,
            };
          }),
        ),
      ]);

    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

    const byCategory = byCategoryGrouped.map((row) => ({
      categoryId: row.categoryId,
      category: categoryNameById.get(row.categoryId) ?? "Unknown",
      total: row._sum.convertedAmountMinor ?? 0,
    }));

    return NextResponse.json({
      month,
      baseCurrency: settings.baseCurrency,
      byCategory,
      byMonth: monthlyTotals,
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
