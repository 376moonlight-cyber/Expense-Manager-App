import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import {
  categoryBodySchema,
  ensureDefaultCategories,
  findUserCategoryByName,
  normalizeCategoryName,
} from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    await ensureDefaultCategories(userId);

    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    return serverError(
      "GET /api/categories",
      error,
      "Failed to list categories.",
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

    const parsed = categoryBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const name = normalizeCategoryName(parsed.data.name);
    const duplicate = await findUserCategoryByName(userId, name);
    if (duplicate) {
      return jsonError("A category with this name already exists.", 409);
    }

    const category = await prisma.category.create({
      data: { name, userId },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return serverError(
      "POST /api/categories",
      error,
      "Failed to create category.",
    );
  }
}
