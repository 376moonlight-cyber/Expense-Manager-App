import { NextRequest, NextResponse } from "next/server";
import {
  invalidJsonError,
  serverError,
  validationError,
} from "@/lib/api";
import {
  getOrCreateSettings,
  parseExchangeRates,
  settingsBodySchema,
} from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const [settings, user, settingRow] = await Promise.all([
      getOrCreateSettings(userId),
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
      prisma.setting.findUnique({
        where: { userId },
        select: { lastBackupAt: true },
      }),
    ]);

    return NextResponse.json({
      ...settings,
      lastBackupAt: settingRow?.lastBackupAt?.toISOString() ?? null,
      name: user?.name ?? "",
      email: user?.email ?? "",
    });
  } catch (error) {
    return serverError("GET /api/settings", error, "Failed to load settings.");
  }
}

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

    const parsed = settingsBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const baseCurrency = parsed.data.baseCurrency;
    const exchangeRates = parseExchangeRates(parsed.data.exchangeRates);

    // Base currency should not carry a rate entry against itself.
    delete exchangeRates[baseCurrency];

    const setting = await prisma.setting.upsert({
      where: { userId },
      create: {
        userId,
        baseCurrency,
        exchangeRates,
      },
      update: {
        baseCurrency,
        exchangeRates,
      },
    });

    return NextResponse.json({
      baseCurrency: setting.baseCurrency,
      exchangeRates: parseExchangeRates(setting.exchangeRates),
    });
  } catch (error) {
    return serverError(
      "PUT /api/settings",
      error,
      "Failed to save settings.",
    );
  }
}
