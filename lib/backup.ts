import path from "path";
import { strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { normalizeCategoryName } from "@/lib/categories";
import { parseExchangeRates, currencyCodeSchema } from "@/lib/currency";
import { normalizeTags } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_RECEIPT_MIME_TYPES,
  deleteReceiptFile,
  isAllowedReceiptMimeType,
  matchesMimeMagic,
  readReceiptFile,
  writeReceiptFile,
  type AllowedReceiptMimeType,
} from "@/lib/receipts";
import { WALLET_TYPES } from "@/lib/wallets";

/** Current ZIP `data.json` format. Version 1 backups remain readable. */
export const BACKUP_FORMAT_VERSION = 2;
export const BACKUP_FORMAT_VERSION_LEGACY = 1;
export const MAX_BACKUP_ZIP_BYTES = 50 * 1024 * 1024;
export const BACKUP_REMINDER_DAYS = 30;

const isoDateTimeSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Must be a valid ISO date string",
  });

const receiptMetaSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
  receiptFile: z
    .string()
    .trim()
    .min(1)
    .max(260)
    .regex(/^receipts\/[^/\\]+$/, {
      message: "Receipt path must be receipts/<filename>",
    }),
});

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  createdAt: isoDateTimeSchema.optional(),
});

const expenseSchema = z.object({
  id: z.string().min(1),
  amountMinor: z.number().int(),
  currency: currencyCodeSchema,
  convertedAmountMinor: z.number().int(),
  exchangeRateUsed: z.number().finite().positive(),
  description: z.string().max(200),
  date: isoDateTimeSchema,
  categoryId: z.string().min(1),
  paymentMethod: z.string().max(40).default("Cash"),
  notes: z.string().max(2000).default(""),
  tags: z.array(z.string()).default([]),
  recurringExpenseId: z.string().nullable().optional(),
  walletId: z.string().min(1).nullable().optional().default(null),
  createdAt: isoDateTimeSchema.optional(),
  receipt: receiptMetaSchema.nullable().optional(),
});

const incomeSchema = z.object({
  id: z.string().min(1),
  amountMinor: z.number().int(),
  currency: currencyCodeSchema,
  convertedAmountMinor: z.number().int(),
  exchangeRateUsed: z.number().finite().positive(),
  source: z.string().min(1).max(80),
  description: z.string().max(200).default(""),
  date: isoDateTimeSchema,
  recurringExpenseId: z.string().nullable().optional(),
  walletId: z.string().min(1).nullable().optional().default(null),
  createdAt: isoDateTimeSchema.optional(),
});

const walletSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  type: z.enum(WALLET_TYPES),
  openingBalanceMinor: z.number().int(),
  createdAt: isoDateTimeSchema.optional(),
});

const transferSchema = z.object({
  id: z.string().min(1),
  fromWalletId: z.string().min(1),
  toWalletId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  note: z.string().max(200).default(""),
  date: isoDateTimeSchema,
  createdAt: isoDateTimeSchema.optional(),
});

const goalSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  targetAmountMinor: z.number().int().positive(),
  savedAmountMinor: z.number().int().nonnegative().default(0),
  deadline: isoDateTimeSchema.nullable().optional().default(null),
  createdAt: isoDateTimeSchema.optional(),
});

const budgetSchema = z.object({
  id: z.string().min(1).optional(),
  categoryId: z.string().min(1),
  monthlyLimitMinor: z.number().int().nonnegative(),
});

const recurringSchema = z.object({
  id: z.string().min(1),
  amountMinor: z.number().int().positive(),
  description: z.string().min(1).max(200),
  type: z.enum(["EXPENSE", "INCOME"]).default("EXPENSE"),
  categoryId: z.string().nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(28),
  active: z.boolean().default(true),
  startDate: isoDateTimeSchema.nullable().optional(),
  endDate: isoDateTimeSchema.nullable().optional(),
  lastGeneratedMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
});

export const backupDataSchema = z
  .object({
    formatVersion: z.union([
      z.literal(BACKUP_FORMAT_VERSION_LEGACY),
      z.literal(BACKUP_FORMAT_VERSION),
    ]),
    createdAt: isoDateTimeSchema,
    settings: z.object({
      baseCurrency: currencyCodeSchema,
      exchangeRates: z.record(
        z.string(),
        z.number().finite().positive(),
      ),
    }),
    categories: z.array(categorySchema),
    expenses: z.array(expenseSchema),
    incomes: z.array(incomeSchema),
    budgets: z.array(budgetSchema),
    recurringItems: z.array(recurringSchema),
    /** Absent on format v1 backups; treated as empty. */
    wallets: z.array(walletSchema).optional().default([]),
    transfers: z.array(transferSchema).optional().default([]),
    goals: z.array(goalSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    const categoryIds = new Set(data.categories.map((c) => c.id));
    const walletIds = new Set(data.wallets.map((w) => w.id));

    for (const [index, expense] of data.expenses.entries()) {
      if (!categoryIds.has(expense.categoryId)) {
        ctx.addIssue({
          code: "custom",
          path: ["expenses", index, "categoryId"],
          message: `Unknown categoryId "${expense.categoryId}".`,
        });
      }
      if (expense.walletId && !walletIds.has(expense.walletId)) {
        ctx.addIssue({
          code: "custom",
          path: ["expenses", index, "walletId"],
          message: `Unknown walletId "${expense.walletId}".`,
        });
      }
    }
    for (const [index, budget] of data.budgets.entries()) {
      if (!categoryIds.has(budget.categoryId)) {
        ctx.addIssue({
          code: "custom",
          path: ["budgets", index, "categoryId"],
          message: `Unknown categoryId "${budget.categoryId}".`,
        });
      }
    }
    for (const [index, item] of data.recurringItems.entries()) {
      if (item.type === "EXPENSE") {
        if (!item.categoryId || !categoryIds.has(item.categoryId)) {
          ctx.addIssue({
            code: "custom",
            path: ["recurringItems", index, "categoryId"],
            message: "Expense recurring items need a valid categoryId.",
          });
        }
      }
    }

    const recurringIds = new Set(data.recurringItems.map((item) => item.id));
    for (const [index, expense] of data.expenses.entries()) {
      if (
        expense.recurringExpenseId &&
        !recurringIds.has(expense.recurringExpenseId)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["expenses", index, "recurringExpenseId"],
          message: `Unknown recurringExpenseId "${expense.recurringExpenseId}".`,
        });
      }
    }
    for (const [index, income] of data.incomes.entries()) {
      if (
        income.recurringExpenseId &&
        !recurringIds.has(income.recurringExpenseId)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["incomes", index, "recurringExpenseId"],
          message: `Unknown recurringExpenseId "${income.recurringExpenseId}".`,
        });
      }
      if (income.walletId && !walletIds.has(income.walletId)) {
        ctx.addIssue({
          code: "custom",
          path: ["incomes", index, "walletId"],
          message: `Unknown walletId "${income.walletId}".`,
        });
      }
    }

    for (const [index, transfer] of data.transfers.entries()) {
      if (!walletIds.has(transfer.fromWalletId)) {
        ctx.addIssue({
          code: "custom",
          path: ["transfers", index, "fromWalletId"],
          message: `Unknown fromWalletId "${transfer.fromWalletId}".`,
        });
      }
      if (!walletIds.has(transfer.toWalletId)) {
        ctx.addIssue({
          code: "custom",
          path: ["transfers", index, "toWalletId"],
          message: `Unknown toWalletId "${transfer.toWalletId}".`,
        });
      }
      if (transfer.fromWalletId === transfer.toWalletId) {
        ctx.addIssue({
          code: "custom",
          path: ["transfers", index, "toWalletId"],
          message: "Transfer from and to wallets must differ.",
        });
      }
    }
  });

export type BackupData = z.infer<typeof backupDataSchema>;

export type BackupPreview = {
  categories: number;
  expenses: number;
  incomes: number;
  budgets: number;
  receipts: number;
  recurringItems: number;
  wallets: number;
  transfers: number;
  goals: number;
  createdAt: string;
  formatVersion: number;
};

export type ParsedBackup = {
  data: BackupData;
  receipts: Map<string, Uint8Array>;
  preview: BackupPreview;
};

export type RestoreMode = "merge" | "replace";

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

/** Reject path traversal and only allow receipts/<filename>.ext */
export function sanitizeReceiptZipPath(raw: string): string | null {
  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.startsWith("receipts/")) return null;
  if (normalized.includes("..") || normalized.includes("//")) return null;
  const rest = normalized.slice("receipts/".length);
  if (!rest || rest.includes("/")) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(rest)) return null;
  const lower = rest.toLowerCase();
  if (
    !(
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".pdf")
    )
  ) {
    return null;
  }
  return `receipts/${rest}`;
}

export function backupFileName(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `expense-tracker-backup-${stamp}.zip`;
}

export function isBackupReminderDue(lastBackupAt: Date | null | undefined): boolean {
  if (!lastBackupAt) return true;
  const ageMs = Date.now() - lastBackupAt.getTime();
  return ageMs >= BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000;
}

function dayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function expenseFingerprint(input: {
  date: string | Date;
  description: string;
  amountMinor: number;
  currency: string;
  categoryName: string;
}): string {
  return [
    dayKey(input.date),
    input.description.trim().toLowerCase(),
    String(input.amountMinor),
    input.currency.toUpperCase(),
    input.categoryName.trim().toLowerCase(),
  ].join("|");
}

function incomeFingerprint(input: {
  date: string | Date;
  source: string;
  description: string;
  amountMinor: number;
  currency: string;
}): string {
  return [
    dayKey(input.date),
    input.source.trim().toLowerCase(),
    input.description.trim().toLowerCase(),
    String(input.amountMinor),
    input.currency.toUpperCase(),
  ].join("|");
}

function recurringFingerprint(input: {
  description: string;
  amountMinor: number;
  dayOfMonth: number;
  type: string;
}): string {
  return [
    input.description.trim().toLowerCase(),
    String(input.amountMinor),
    String(input.dayOfMonth),
    input.type,
  ].join("|");
}

function transferFingerprint(input: {
  fromWalletId: string;
  toWalletId: string;
  amountMinor: number;
  date: string | Date;
  note: string;
}): string {
  return [
    input.fromWalletId,
    input.toWalletId,
    String(input.amountMinor),
    dayKey(input.date),
    input.note.trim().toLowerCase(),
  ].join("|");
}

export async function collectUserBackupData(userId: string): Promise<{
  data: BackupData;
  receiptFiles: Map<string, Uint8Array>;
}> {
  const [
    setting,
    categories,
    expenses,
    incomes,
    budgets,
    recurringItems,
    wallets,
    transfers,
    goals,
  ] = await Promise.all([
      prisma.setting.findUnique({ where: { userId } }),
      prisma.category.findMany({
        where: { userId },
        orderBy: { name: "asc" },
      }),
      prisma.expense.findMany({
        where: { userId },
        include: { receipt: true },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      prisma.income.findMany({
        where: { userId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      prisma.budget.findMany({ where: { userId } }),
      prisma.recurringExpense.findMany({
        where: { userId },
        orderBy: [{ description: "asc" }, { dayOfMonth: "asc" }],
      }),
      prisma.wallet.findMany({
        where: { userId },
        orderBy: [{ createdAt: "asc" }],
      }),
      prisma.walletTransfer.findMany({
        where: { userId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      prisma.goal.findMany({
        where: { userId },
        orderBy: [{ createdAt: "asc" }],
      }),
    ]);

  const receiptFiles = new Map<string, Uint8Array>();
  const createdAt = new Date().toISOString();

  const expensePayload: BackupData["expenses"] = [];
  for (const expense of expenses) {
    let receipt: BackupData["expenses"][number]["receipt"] = null;
    if (expense.receipt) {
      const ext =
        ALLOWED_RECEIPT_MIME_TYPES[
          expense.receipt.mimeType as AllowedReceiptMimeType
        ] ?? path.extname(expense.receipt.storagePath) ?? ".bin";
      const zipName = `receipts/${expense.receipt.id}${ext.startsWith(".") ? ext : `.${ext}`}`;
      try {
        const bytes = await readReceiptFile(expense.receipt.storagePath);
        receiptFiles.set(zipName, new Uint8Array(bytes));
        receipt = {
          fileName: expense.receipt.fileName,
          mimeType: expense.receipt.mimeType as AllowedReceiptMimeType,
          sizeBytes: expense.receipt.sizeBytes,
          receiptFile: zipName,
        };
      } catch {
        // Skip missing receipt files rather than failing the whole backup.
        receipt = null;
      }
    }

    expensePayload.push({
      id: expense.id,
      amountMinor: expense.amountMinor,
      currency: expense.currency,
      convertedAmountMinor: expense.convertedAmountMinor,
      exchangeRateUsed: expense.exchangeRateUsed,
      description: expense.description,
      date: expense.date.toISOString(),
      categoryId: expense.categoryId,
      paymentMethod: expense.paymentMethod,
      notes: expense.notes,
      tags: normalizeTags(expense.tags),
      recurringExpenseId: expense.recurringExpenseId,
      walletId: expense.walletId,
      createdAt: expense.createdAt.toISOString(),
      receipt,
    });
  }

  const data: BackupData = {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt,
    settings: {
      baseCurrency: setting?.baseCurrency ?? "PKR",
      exchangeRates: parseExchangeRates(setting?.exchangeRates),
    },
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      createdAt: category.createdAt.toISOString(),
    })),
    expenses: expensePayload,
    incomes: incomes.map((income) => ({
      id: income.id,
      amountMinor: income.amountMinor,
      currency: income.currency,
      convertedAmountMinor: income.convertedAmountMinor,
      exchangeRateUsed: income.exchangeRateUsed,
      source: income.source,
      description: income.description,
      date: income.date.toISOString(),
      recurringExpenseId: income.recurringExpenseId,
      walletId: income.walletId,
      createdAt: income.createdAt.toISOString(),
    })),
    budgets: budgets.map((budget) => ({
      id: budget.id,
      categoryId: budget.categoryId,
      monthlyLimitMinor: budget.monthlyLimitMinor,
    })),
    recurringItems: recurringItems.map((item) => ({
      id: item.id,
      amountMinor: item.amountMinor,
      description: item.description,
      type: item.type,
      categoryId: item.categoryId,
      dayOfMonth: item.dayOfMonth,
      active: item.active,
      startDate: item.startDate?.toISOString() ?? null,
      endDate: item.endDate?.toISOString() ?? null,
      lastGeneratedMonth: item.lastGeneratedMonth,
    })),
    wallets: wallets.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      type: wallet.type as (typeof WALLET_TYPES)[number],
      openingBalanceMinor: wallet.openingBalanceMinor,
      createdAt: wallet.createdAt.toISOString(),
    })),
    transfers: transfers.map((transfer) => ({
      id: transfer.id,
      fromWalletId: transfer.fromWalletId,
      toWalletId: transfer.toWalletId,
      amountMinor: transfer.amountMinor,
      note: transfer.note,
      date: transfer.date.toISOString(),
      createdAt: transfer.createdAt.toISOString(),
    })),
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetAmountMinor: goal.targetAmountMinor,
      savedAmountMinor: goal.savedAmountMinor,
      deadline: goal.deadline?.toISOString() ?? null,
      createdAt: goal.createdAt.toISOString(),
    })),
  };

  return { data, receiptFiles };
}

export function buildBackupZip(
  data: BackupData,
  receiptFiles: Map<string, Uint8Array>,
): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "data.json": strToU8(JSON.stringify(data, null, 2)),
  };
  for (const [name, bytes] of receiptFiles) {
    const safe = sanitizeReceiptZipPath(name);
    if (!safe) {
      throw new BackupValidationError(`Unsafe receipt path in backup: ${name}`);
    }
    files[safe] = bytes;
  }
  return zipSync(files, { level: 6 });
}

export function parseBackupZip(zipBytes: Uint8Array): ParsedBackup {
  if (zipBytes.byteLength === 0) {
    throw new BackupValidationError("Backup file is empty.");
  }
  if (zipBytes.byteLength > MAX_BACKUP_ZIP_BYTES) {
    throw new BackupValidationError("Backup must be 50 MB or smaller.");
  }

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(zipBytes);
  } catch {
    throw new BackupValidationError("Invalid or corrupted ZIP file.");
  }

  const dataEntry = unzipped["data.json"];
  if (!dataEntry) {
    throw new BackupValidationError("Backup is missing data.json.");
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(strFromU8(dataEntry));
  } catch {
    throw new BackupValidationError("data.json is not valid JSON.");
  }

  const parsed = backupDataSchema.safeParse(rawJson);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const pathLabel = first?.path?.length
      ? first.path.join(".")
      : "data.json";
    throw new BackupValidationError(
      `Invalid backup data (${pathLabel}): ${first?.message ?? "validation failed"}.`,
    );
  }

  const receipts = new Map<string, Uint8Array>();
  for (const [rawName, bytes] of Object.entries(unzipped)) {
    const name = rawName.replace(/\\/g, "/");
    if (name === "data.json" || name.endsWith("/")) continue;
    if (name.startsWith("receipts/")) {
      const safe = sanitizeReceiptZipPath(name);
      if (!safe) {
        throw new BackupValidationError(
          `Unsafe or invalid receipt path: ${name}`,
        );
      }
      const lower = safe.toLowerCase();
      const mime: AllowedReceiptMimeType | null = lower.endsWith(".pdf")
        ? "application/pdf"
        : lower.endsWith(".png")
          ? "image/png"
          : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
            ? "image/jpeg"
            : null;
      if (!mime) {
        throw new BackupValidationError(
          `Only JPEG, PNG, and PDF receipt files are allowed (${name}).`,
        );
      }
      const buffer = Buffer.from(bytes);
      if (!matchesMimeMagic(mime, buffer)) {
        throw new BackupValidationError(
          `Receipt file contents do not match type (${name}).`,
        );
      }
      receipts.set(safe, bytes);
      continue;
    }
    // Ignore other top-level files rather than failing (forward compatible).
  }

  for (const expense of parsed.data.expenses) {
    if (!expense.receipt) continue;
    const safe = sanitizeReceiptZipPath(expense.receipt.receiptFile);
    if (!safe) {
      throw new BackupValidationError(
        `Unsafe receipt path referenced by expense ${expense.id}.`,
      );
    }
    if (safe !== expense.receipt.receiptFile) {
      throw new BackupValidationError(
        `Invalid receipt path for expense ${expense.id}.`,
      );
    }
    const bytes = receipts.get(safe);
    if (!bytes) {
      throw new BackupValidationError(
        `Missing receipt file "${safe}" referenced by expense ${expense.id}.`,
      );
    }
    if (!isAllowedReceiptMimeType(expense.receipt.mimeType)) {
      throw new BackupValidationError(
        `Unsupported receipt mime type for expense ${expense.id}.`,
      );
    }
    if (bytes.byteLength !== expense.receipt.sizeBytes) {
      throw new BackupValidationError(
        `Receipt size mismatch for "${safe}".`,
      );
    }
    if (
      !matchesMimeMagic(
        expense.receipt.mimeType,
        Buffer.from(bytes),
      )
    ) {
      throw new BackupValidationError(
        `Receipt magic bytes do not match mime type for "${safe}".`,
      );
    }
  }

  const receiptCount = parsed.data.expenses.filter((e) => e.receipt).length;

  return {
    data: parsed.data,
    receipts,
    preview: {
      categories: parsed.data.categories.length,
      expenses: parsed.data.expenses.length,
      incomes: parsed.data.incomes.length,
      budgets: parsed.data.budgets.length,
      receipts: receiptCount,
      recurringItems: parsed.data.recurringItems.length,
      wallets: parsed.data.wallets.length,
      transfers: parsed.data.transfers.length,
      goals: parsed.data.goals.length,
      createdAt: parsed.data.createdAt,
      formatVersion: parsed.data.formatVersion,
    },
  };
}

type Tx = Prisma.TransactionClient;

async function deleteUserBackupScopedData(tx: Tx, userId: string) {
  // Receipts cascade from expenses; clear dependents before categories/wallets.
  await tx.expense.deleteMany({ where: { userId } });
  await tx.income.deleteMany({ where: { userId } });
  await tx.walletTransfer.deleteMany({ where: { userId } });
  await tx.budget.deleteMany({ where: { userId } });
  await tx.recurringExpense.deleteMany({ where: { userId } });
  await tx.category.deleteMany({ where: { userId } });
  await tx.wallet.deleteMany({ where: { userId } });
  await tx.goal.deleteMany({ where: { userId } });
}

async function applyBackupInTransaction(
  tx: Tx,
  userId: string,
  parsed: ParsedBackup,
  mode: RestoreMode,
): Promise<{
  writtenReceipts: string[];
  counts: {
    categories: number;
    expenses: number;
    incomes: number;
    budgets: number;
    receipts: number;
    recurringItems: number;
    wallets: number;
    transfers: number;
    goals: number;
  };
}> {
  const { data, receipts } = parsed;
  const writtenReceipts: string[] = [];
  const categoryIdMap = new Map<string, string>();
  const recurringIdMap = new Map<string, string>();
  const walletIdMap = new Map<string, string>();

  let categoriesCreated = 0;
  let expensesCreated = 0;
  let incomesCreated = 0;
  let budgetsCreated = 0;
  let receiptsCreated = 0;
  let recurringCreated = 0;
  let walletsCreated = 0;
  let transfersCreated = 0;
  let goalsCreated = 0;

  if (mode === "replace") {
    const expensesWithReceipts = await tx.expense.findMany({
      where: { userId },
      include: { receipt: true },
    });
    for (const expense of expensesWithReceipts) {
      if (expense.receipt) {
        // Defer file deletion until after a successful commit.
        writtenReceipts.push(`DELETE:${expense.receipt.storagePath}`);
      }
    }
    await deleteUserBackupScopedData(tx, userId);
  }

  const existingCategories = await tx.category.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const categoryByName = new Map(
    existingCategories.map((c) => [c.name.toLowerCase(), c]),
  );

  for (const category of data.categories) {
    const name = normalizeCategoryName(category.name);
    const key = name.toLowerCase();
    const existing = categoryByName.get(key);
    if (existing) {
      categoryIdMap.set(category.id, existing.id);
      continue;
    }
    const created = await tx.category.create({
      data: { name, userId },
    });
    categoryByName.set(key, created);
    categoryIdMap.set(category.id, created.id);
    categoriesCreated += 1;
  }

  // Wallets before expenses/income/transfers so FKs can be remapped.
  const existingWallets = await tx.wallet.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const walletByName = new Map(
    existingWallets.map((w) => [w.name.toLowerCase(), w]),
  );

  for (const wallet of data.wallets) {
    const name = wallet.name.trim();
    const key = name.toLowerCase();
    const existing = walletByName.get(key);
    if (existing) {
      walletIdMap.set(wallet.id, existing.id);
      continue;
    }
    const created = await tx.wallet.create({
      data: {
        name,
        type: wallet.type,
        openingBalanceMinor: wallet.openingBalanceMinor,
        userId,
      },
    });
    walletByName.set(key, created);
    walletIdMap.set(wallet.id, created.id);
    walletsCreated += 1;
  }

  // Recurring first so expenses/income can remap FKs.
  const existingRecurring = await tx.recurringExpense.findMany({
    where: { userId },
  });
  const recurringByFingerprint = new Map(
    existingRecurring.map((item) => [
      recurringFingerprint(item),
      item,
    ]),
  );

  for (const item of data.recurringItems) {
    const mappedCategoryId = item.categoryId
      ? (categoryIdMap.get(item.categoryId) ?? null)
      : null;
    if (item.type === "EXPENSE" && !mappedCategoryId) {
      throw new BackupValidationError(
        `Could not resolve category for recurring item "${item.description}".`,
      );
    }

    const fingerprint = recurringFingerprint({
      description: item.description,
      amountMinor: item.amountMinor,
      dayOfMonth: item.dayOfMonth,
      type: item.type,
    });

    if (mode === "merge") {
      const existing = recurringByFingerprint.get(fingerprint);
      if (existing) {
        recurringIdMap.set(item.id, existing.id);
        continue;
      }
    }

    const created = await tx.recurringExpense.create({
      data: {
        amountMinor: item.amountMinor,
        description: item.description,
        type: item.type,
        categoryId: mappedCategoryId,
        userId,
        dayOfMonth: item.dayOfMonth,
        active: item.active,
        startDate: item.startDate ? new Date(item.startDate) : null,
        endDate: item.endDate ? new Date(item.endDate) : null,
        lastGeneratedMonth: item.lastGeneratedMonth ?? null,
      },
    });
    recurringIdMap.set(item.id, created.id);
    recurringByFingerprint.set(fingerprint, created);
    recurringCreated += 1;
  }

  const existingExpenses = await tx.expense.findMany({
    where: { userId },
    include: { category: { select: { name: true } } },
  });
  const expenseByFingerprint = new Set(
    existingExpenses.map((expense) =>
      expenseFingerprint({
        date: expense.date,
        description: expense.description,
        amountMinor: expense.amountMinor,
        currency: expense.currency,
        categoryName: expense.category.name,
      }),
    ),
  );

  // Buffer receipt writes until after DB rows exist; write files then create Receipt rows.
  type PendingReceipt = {
    expenseId: string;
    fileName: string;
    mimeType: AllowedReceiptMimeType;
    bytes: Buffer;
  };
  const pendingReceipts: PendingReceipt[] = [];

  for (const expense of data.expenses) {
    const categoryId = categoryIdMap.get(expense.categoryId);
    if (!categoryId) {
      throw new BackupValidationError(
        `Could not resolve category for expense "${expense.description}".`,
      );
    }
    const categoryName =
      [...categoryByName.values()].find((c) => c.id === categoryId)?.name ??
      "";

    const fingerprint = expenseFingerprint({
      date: expense.date,
      description: expense.description,
      amountMinor: expense.amountMinor,
      currency: expense.currency,
      categoryName,
    });

    if (mode === "merge" && expenseByFingerprint.has(fingerprint)) {
      continue;
    }

    const mappedWalletId = expense.walletId
      ? (walletIdMap.get(expense.walletId) ?? null)
      : null;
    if (expense.walletId && !mappedWalletId) {
      throw new BackupValidationError(
        `Could not resolve wallet for expense "${expense.description}".`,
      );
    }

    const created = await tx.expense.create({
      data: {
        amountMinor: expense.amountMinor,
        currency: expense.currency,
        convertedAmountMinor: expense.convertedAmountMinor,
        exchangeRateUsed: expense.exchangeRateUsed,
        description: expense.description,
        date: new Date(expense.date),
        categoryId,
        userId,
        paymentMethod: expense.paymentMethod,
        notes: expense.notes,
        tags: normalizeTags(expense.tags),
        recurringExpenseId: expense.recurringExpenseId
          ? (recurringIdMap.get(expense.recurringExpenseId) ?? null)
          : null,
        walletId: mappedWalletId,
      },
    });
    expensesCreated += 1;
    expenseByFingerprint.add(fingerprint);

    if (expense.receipt) {
      const bytes = receipts.get(expense.receipt.receiptFile);
      if (!bytes) {
        throw new BackupValidationError(
          `Missing receipt bytes for "${expense.receipt.receiptFile}".`,
        );
      }
      pendingReceipts.push({
        expenseId: created.id,
        fileName: expense.receipt.fileName,
        mimeType: expense.receipt.mimeType,
        bytes: Buffer.from(bytes),
      });
    }
  }

  const existingIncomes = await tx.income.findMany({ where: { userId } });
  const incomeByFingerprint = new Set(
    existingIncomes.map((income) =>
      incomeFingerprint({
        date: income.date,
        source: income.source,
        description: income.description,
        amountMinor: income.amountMinor,
        currency: income.currency,
      }),
    ),
  );

  for (const income of data.incomes) {
    const fingerprint = incomeFingerprint({
      date: income.date,
      source: income.source,
      description: income.description,
      amountMinor: income.amountMinor,
      currency: income.currency,
    });
    if (mode === "merge" && incomeByFingerprint.has(fingerprint)) {
      continue;
    }

    const mappedWalletId = income.walletId
      ? (walletIdMap.get(income.walletId) ?? null)
      : null;
    if (income.walletId && !mappedWalletId) {
      throw new BackupValidationError(
        `Could not resolve wallet for income "${income.source}".`,
      );
    }

    await tx.income.create({
      data: {
        amountMinor: income.amountMinor,
        currency: income.currency,
        convertedAmountMinor: income.convertedAmountMinor,
        exchangeRateUsed: income.exchangeRateUsed,
        source: income.source,
        description: income.description,
        date: new Date(income.date),
        userId,
        recurringExpenseId: income.recurringExpenseId
          ? (recurringIdMap.get(income.recurringExpenseId) ?? null)
          : null,
        walletId: mappedWalletId,
      },
    });
    incomesCreated += 1;
    incomeByFingerprint.add(fingerprint);
  }

  const existingTransfers = await tx.walletTransfer.findMany({
    where: { userId },
  });
  const transferByFingerprint = new Set(
    existingTransfers.map((transfer) =>
      transferFingerprint({
        fromWalletId: transfer.fromWalletId,
        toWalletId: transfer.toWalletId,
        amountMinor: transfer.amountMinor,
        date: transfer.date,
        note: transfer.note,
      }),
    ),
  );

  for (const transfer of data.transfers) {
    const fromWalletId = walletIdMap.get(transfer.fromWalletId);
    const toWalletId = walletIdMap.get(transfer.toWalletId);
    if (!fromWalletId || !toWalletId) {
      throw new BackupValidationError(
        "Could not resolve wallets for a transfer in the backup.",
      );
    }
    if (fromWalletId === toWalletId) {
      throw new BackupValidationError(
        "Transfer from and to wallets must differ after remapping.",
      );
    }

    const fingerprint = transferFingerprint({
      fromWalletId,
      toWalletId,
      amountMinor: transfer.amountMinor,
      date: transfer.date,
      note: transfer.note,
    });

    if (mode === "merge" && transferByFingerprint.has(fingerprint)) {
      continue;
    }

    await tx.walletTransfer.create({
      data: {
        userId,
        fromWalletId,
        toWalletId,
        amountMinor: transfer.amountMinor,
        note: transfer.note,
        date: new Date(transfer.date),
      },
    });
    transferByFingerprint.add(fingerprint);
    transfersCreated += 1;
  }

  const existingBudgets = await tx.budget.findMany({
    where: { userId },
    select: { categoryId: true },
  });
  const budgetedCategories = new Set(
    existingBudgets.map((budget) => budget.categoryId),
  );

  for (const budget of data.budgets) {
    const categoryId = categoryIdMap.get(budget.categoryId);
    if (!categoryId) continue;
    if (mode === "merge" && budgetedCategories.has(categoryId)) {
      continue;
    }
    if (mode === "replace" || !budgetedCategories.has(categoryId)) {
      await tx.budget.create({
        data: {
          userId,
          categoryId,
          monthlyLimitMinor: budget.monthlyLimitMinor,
        },
      });
      budgetedCategories.add(categoryId);
      budgetsCreated += 1;
    }
  }

  const existingGoals = await tx.goal.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const goalByName = new Map(
    existingGoals.map((goal) => [goal.name.toLowerCase(), goal]),
  );

  for (const goal of data.goals) {
    const name = goal.name.trim();
    const key = name.toLowerCase();
    if (goalByName.has(key)) {
      continue;
    }
    const created = await tx.goal.create({
      data: {
        name,
        targetAmountMinor: goal.targetAmountMinor,
        savedAmountMinor: goal.savedAmountMinor,
        deadline: goal.deadline ? new Date(goal.deadline) : null,
        userId,
      },
    });
    goalByName.set(key, created);
    goalsCreated += 1;
  }

  if (mode === "replace") {
    const rates = parseExchangeRates(data.settings.exchangeRates);
    delete rates[data.settings.baseCurrency];
    await tx.setting.upsert({
      where: { userId },
      create: {
        userId,
        baseCurrency: data.settings.baseCurrency,
        exchangeRates: rates,
      },
      update: {
        baseCurrency: data.settings.baseCurrency,
        exchangeRates: rates,
      },
    });
  }

  // Write receipt files and rows. If a later write fails, caller cleans up.
  for (const pending of pendingReceipts) {
    const { storagePath, sizeBytes } = await writeReceiptFile(
      pending.mimeType,
      pending.bytes,
    );
    writtenReceipts.push(storagePath);
    await tx.receipt.create({
      data: {
        expenseId: pending.expenseId,
        fileName: pending.fileName,
        mimeType: pending.mimeType,
        sizeBytes,
        storagePath,
      },
    });
    receiptsCreated += 1;
  }

  return {
    writtenReceipts,
    counts: {
      categories: categoriesCreated,
      expenses: expensesCreated,
      incomes: incomesCreated,
      budgets: budgetsCreated,
      receipts: receiptsCreated,
      recurringItems: recurringCreated,
      wallets: walletsCreated,
      transfers: transfersCreated,
      goals: goalsCreated,
    },
  };
}

export async function restoreBackupForUser(
  userId: string,
  parsed: ParsedBackup,
  mode: RestoreMode,
): Promise<{
  counts: {
    categories: number;
    expenses: number;
    incomes: number;
    budgets: number;
    receipts: number;
    recurringItems: number;
    wallets: number;
    transfers: number;
    goals: number;
  };
}> {
  const filesToDeleteAfter: string[] = [];
  const writtenDuring: string[] = [];

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const applied = await applyBackupInTransaction(
          tx,
          userId,
          parsed,
          mode,
        );
        for (const entry of applied.writtenReceipts) {
          if (entry.startsWith("DELETE:")) {
            filesToDeleteAfter.push(entry.slice("DELETE:".length));
          } else {
            writtenDuring.push(entry);
          }
        }
        return applied.counts;
      },
      { maxWait: 15_000, timeout: 60_000 },
    );

    for (const storagePath of filesToDeleteAfter) {
      await deleteReceiptFile(storagePath).catch(() => undefined);
    }

    return { counts: result };
  } catch (error) {
    for (const storagePath of writtenDuring) {
      await deleteReceiptFile(storagePath).catch(() => undefined);
    }
    throw error;
  }
}

export async function markBackupDownloaded(userId: string): Promise<Date> {
  const now = new Date();
  await prisma.setting.upsert({
    where: { userId },
    create: {
      userId,
      lastBackupAt: now,
    },
    update: {
      lastBackupAt: now,
    },
  });
  return now;
}
