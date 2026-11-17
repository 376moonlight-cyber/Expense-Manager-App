import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  serverError,
  validationError,
} from "@/lib/api";
import { toMinorUnits } from "@/lib/expenses";
import { goalBodySchema } from "@/lib/goals";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const goals = await prisma.goal.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }],
    });

    return NextResponse.json(goals);
  } catch (error) {
    return serverError("GET /api/goals", error, "Failed to list goals.");
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

    const parsed = goalBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { name, targetAmount, savedAmount, deadline } = parsed.data;

    const goal = await prisma.goal.create({
      data: {
        name,
        targetAmountMinor: toMinorUnits(targetAmount),
        savedAmountMinor: toMinorUnits(savedAmount),
        deadline: deadline ? new Date(deadline) : null,
        userId,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    return serverError("POST /api/goals", error, "Failed to create goal.");
  }
}
