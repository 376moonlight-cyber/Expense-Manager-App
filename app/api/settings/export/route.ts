import { NextRequest, NextResponse } from "next/server";
import { serverError, validationError } from "@/lib/api";
import { getOrCreateSettings } from "@/lib/currency";
import { escapeCsv } from "@/lib/csv";
import { formatMinorUnits } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { z } from "zod";

const exportTypeSchema = z.enum(["expenses", "income"], {
  error: "type must be expenses or income",
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const typeParam = request.nextUrl.searchParams.get("type");
    const parsedType = exportTypeSchema.safeParse(typeParam);
    if (!parsedType.success) {
      return validationError(parsedType.error);
    }

    const settings = await getOrCreateSettings(userId);
    const stamp = new Date().toISOString().slice(0, 10);

    if (parsedType.data === "expenses") {
      const rows = await prisma.expense.findMany({
        where: { userId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        include: { category: { select: { name: true } } },
      });

      const lines = [
        "date,description,category,amount,currency,converted_amount,base_currency,exchange_rate,payment_method,notes",
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
            escapeCsv(row.paymentMethod),
            escapeCsv(row.notes),
          ].join(","),
        ),
      ];

      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="expenses-${stamp}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const rows = await prisma.income.findMany({
      where: { userId },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    const lines = [
      "date,source,description,amount,currency,converted_amount,base_currency,exchange_rate",
      ...rows.map((row) =>
        [
          row.date.toISOString().slice(0, 10),
          escapeCsv(row.source),
          escapeCsv(row.description),
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
        "Content-Disposition": `attachment; filename="income-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return serverError(
      "GET /api/settings/export",
      error,
      "Failed to export data.",
    );
  }
}
