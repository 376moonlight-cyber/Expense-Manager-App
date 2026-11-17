import { compare, hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  jsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { changePasswordSchema } from "@/lib/auth-validation";
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

    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      return jsonError("User not found.", 404);
    }

    const currentOk = await compare(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!currentOk) {
      return jsonError("Current password is incorrect.", 400);
    }

    const passwordHash = await hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(
      "POST /api/settings/password",
      error,
      "Failed to change password.",
    );
  }
}
