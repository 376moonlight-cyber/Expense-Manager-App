import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { ensureDefaultCategories } from "@/lib/categories";
import {
  importPreviewBodySchema,
  parseExpenseImportCsv,
} from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

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

    const parsed = importPreviewBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { rows, headerError } = parseExpenseImportCsv(parsed.data.csv);
    if (headerError) {
      return jsonError(headerError, 400);
    }

    await ensureDefaultCategories(userId);

    const existingCategories = await prisma.category.findMany({
      where: { userId },
      select: { name: true },
    });
    const existingNames = new Set(
      existingCategories.map((category) => category.name.toLowerCase()),
    );

    const missingSet = new Map<string, string>();
    const previewRows = [];

    for (const row of rows) {
      if (row.status === "error") {
        previewRows.push({
          rowNumber: row.rowNumber,
          date: row.date,
          description: row.description,
          category: row.category,
          amount: row.amount,
          status: "error" as const,
          error: row.error ?? "Invalid row.",
          categoryExists: false,
        });
        continue;
      }

      const categoryExists = existingNames.has(row.category.toLowerCase());
      if (!categoryExists) {
        const key = row.category.toLowerCase();
        if (!missingSet.has(key)) {
          missingSet.set(key, row.category);
        }
      }

      previewRows.push({
        rowNumber: row.rowNumber,
        date: row.date,
        description: row.description,
        category: row.category,
        amount: row.amount,
        status: "ok" as const,
        categoryExists,
      });
    }

    const validRows = previewRows.filter((row) => row.status === "ok");
    const errorRows = previewRows.filter((row) => row.status === "error");

    return NextResponse.json({
      rows: previewRows,
      validCount: validRows.length,
      errorCount: errorRows.length,
      missingCategories: [...missingSet.values()].sort((a, b) =>
        a.localeCompare(b),
      ),
    });
  } catch (error) {
    return serverError(
      "POST /api/settings/import/preview",
      error,
      "Failed to preview import.",
    );
  }
}
