import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import {
  categoryBodySchema,
  findUserCategoryByName,
  normalizeCategoryName,
} from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const existing = await prisma.category.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return jsonError("Category not found.", 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonError();
    }

    const parsed = categoryBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const name = normalizeCategoryName(parsed.data.name);
    const duplicate = await findUserCategoryByName(userId, name);
    if (duplicate && duplicate.id !== id) {
      return jsonError("A category with this name already exists.", 409);
    }

    const category = await prisma.category.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json(category);
  } catch (error) {
    return serverError(
      "PATCH /api/categories/[id]",
      error,
      "Failed to rename category.",
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const existing = await prisma.category.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return jsonError("Category not found.", 404);
    }

    const expenseCount = await prisma.expense.count({
      where: { categoryId: id, userId },
    });
    if (expenseCount > 0) {
      return jsonError(
        `Cannot delete "${existing.name}" because it still has ${expenseCount} expense${expenseCount === 1 ? "" : "s"}. Move or delete those expenses first.`,
        409,
      );
    }

    const recurringCount = await prisma.recurringExpense.count({
      where: { categoryId: id, userId },
    });
    if (recurringCount > 0) {
      return jsonError(
        `Cannot delete "${existing.name}" because it is used by ${recurringCount} recurring item${recurringCount === 1 ? "" : "s"}. Remove or reassign those first.`,
        409,
      );
    }

    // Budgets are per-user+category; clear them so the delete can proceed.
    await prisma.budget.deleteMany({ where: { categoryId: id, userId } });
    await prisma.category.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serverError(
      "DELETE /api/categories/[id]",
      error,
      "Failed to delete category.",
    );
  }
}
