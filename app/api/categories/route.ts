import { NextResponse } from "next/server";
import { serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;

    // Categories are shared; still require login so the list isn't public.
    const categories = await prisma.category.findMany({
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
