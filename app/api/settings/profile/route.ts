import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { profileNameSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function PUT(request: NextRequest) {
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

    const parsed = profileNameSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: parsed.data.name },
      select: { name: true, email: true },
    });

    if (!user) {
      return jsonError("User not found.", 404);
    }

    return NextResponse.json({
      name: user.name ?? "",
      email: user.email,
    });
  } catch (error) {
    return serverError(
      "PUT /api/settings/profile",
      error,
      "Failed to update profile.",
    );
  }
}
