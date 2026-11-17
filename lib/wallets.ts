import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const WALLET_TYPES = ["Cash", "Bank", "Mobile wallet"] as const;

export type WalletType = (typeof WALLET_TYPES)[number];

export const walletBodySchema = z.object({
  name: z
    .string({ error: "Name must be a string" })
    .trim()
    .min(1, { message: "Name is required" })
    .max(80, { message: "Name must be at most 80 characters" }),
  type: z.enum(WALLET_TYPES, {
    error: "Wallet type is invalid",
  }),
  openingBalance: z
    .number({ error: "Opening balance must be a number" })
    .finite({ message: "Opening balance must be a finite number" }),
});

export type WalletBody = z.infer<typeof walletBodySchema>;

export const walletTransferSchema = z.object({
  fromWalletId: z
    .string({ error: "From wallet ID must be a string" })
    .min(1, { message: "From wallet is required" }),
  toWalletId: z
    .string({ error: "To wallet ID must be a string" })
    .min(1, { message: "To wallet is required" }),
  amount: z
    .number({ error: "Amount must be a number" })
    .positive({ message: "Amount must be positive" })
    .finite({ message: "Amount must be a finite number" }),
  note: z
    .string({ error: "Note must be a string" })
    .trim()
    .max(200, { message: "Note must be at most 200 characters" })
    .optional()
    .default(""),
  date: z
    .string({ error: "Date must be a string" })
    .optional()
    .refine((value) => value == null || !Number.isNaN(Date.parse(value)), {
      message: "Date must be a valid date",
    }),
});

export type WalletTransferBody = z.infer<typeof walletTransferSchema>;

/** Optional wallet id on expense/income — empty string becomes null. */
export const optionalWalletIdSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((value) => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

/** Ensure a wallet belongs to the logged-in user. */
export async function findUserWallet(userId: string, walletId: string) {
  return prisma.wallet.findFirst({
    where: { id: walletId, userId },
  });
}

/**
 * Current balance in base-currency minor units:
 * opening + income − expense − transfers out + transfers in.
 */
export function computeWalletBalanceMinor(input: {
  openingBalanceMinor: number;
  incomeMinor: number;
  expenseMinor: number;
  transferredInMinor: number;
  transferredOutMinor: number;
}): number {
  return (
    input.openingBalanceMinor +
    input.incomeMinor -
    input.expenseMinor +
    input.transferredInMinor -
    input.transferredOutMinor
  );
}

/** Load wallets for a user with computed current balances. */
export async function listWalletsWithBalances(userId: string) {
  const wallets = await prisma.wallet.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }],
  });

  if (wallets.length === 0) return [];

  const walletIds = wallets.map((w) => w.id);

  const [incomeGroups, expenseGroups, outGroups, inGroups] = await Promise.all([
    prisma.income.groupBy({
      by: ["walletId"],
      where: { userId, walletId: { in: walletIds } },
      _sum: { convertedAmountMinor: true },
    }),
    prisma.expense.groupBy({
      by: ["walletId"],
      where: { userId, walletId: { in: walletIds } },
      _sum: { convertedAmountMinor: true },
    }),
    prisma.walletTransfer.groupBy({
      by: ["fromWalletId"],
      where: { userId, fromWalletId: { in: walletIds } },
      _sum: { amountMinor: true },
    }),
    prisma.walletTransfer.groupBy({
      by: ["toWalletId"],
      where: { userId, toWalletId: { in: walletIds } },
      _sum: { amountMinor: true },
    }),
  ]);

  const incomeMap = new Map(
    incomeGroups.map((row) => [row.walletId, row._sum.convertedAmountMinor ?? 0]),
  );
  const expenseMap = new Map(
    expenseGroups.map((row) => [row.walletId, row._sum.convertedAmountMinor ?? 0]),
  );
  const outMap = new Map(
    outGroups.map((row) => [row.fromWalletId, row._sum.amountMinor ?? 0]),
  );
  const inMap = new Map(
    inGroups.map((row) => [row.toWalletId, row._sum.amountMinor ?? 0]),
  );

  return wallets.map((wallet) => {
    const balanceMinor = computeWalletBalanceMinor({
      openingBalanceMinor: wallet.openingBalanceMinor,
      incomeMinor: incomeMap.get(wallet.id) ?? 0,
      expenseMinor: expenseMap.get(wallet.id) ?? 0,
      transferredInMinor: inMap.get(wallet.id) ?? 0,
      transferredOutMinor: outMap.get(wallet.id) ?? 0,
    });

    return {
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      openingBalanceMinor: wallet.openingBalanceMinor,
      balanceMinor,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  });
}
