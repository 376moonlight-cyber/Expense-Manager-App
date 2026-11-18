import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_FORMAT_VERSION_LEGACY,
  backupFileName,
  buildBackupZip,
  isBackupReminderDue,
  parseBackupZip,
  sanitizeReceiptZipPath,
  type BackupData,
} from "./backup";

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function sampleBackup(overrides?: Partial<BackupData>): BackupData {
  const base: BackupData = {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: "2026-11-17T12:00:00.000Z",
    settings: {
      baseCurrency: "PKR",
      exchangeRates: { USD: 280 },
    },
    categories: [
      { id: "cat_food", name: "Food", createdAt: "2026-01-01T00:00:00.000Z" },
      {
        id: "cat_transport",
        name: "Transport",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    expenses: [
      {
        id: "exp_1",
        amountMinor: 1500,
        currency: "PKR",
        convertedAmountMinor: 1500,
        exchangeRateUsed: 1,
        description: "Lunch",
        date: "2026-11-01T00:00:00.000Z",
        categoryId: "cat_food",
        paymentMethod: "Cash",
        notes: "",
        tags: ["food"],
        recurringExpenseId: null,
        walletId: "wal_cash",
        receipt: {
          fileName: "lunch.jpg",
          mimeType: "image/jpeg",
          sizeBytes: jpegBytes.byteLength,
          receiptFile: "receipts/lunch.jpg",
        },
      },
    ],
    incomes: [
      {
        id: "inc_1",
        amountMinor: 100000,
        currency: "PKR",
        convertedAmountMinor: 100000,
        exchangeRateUsed: 1,
        source: "Salary",
        description: "November",
        date: "2026-11-01T00:00:00.000Z",
        recurringExpenseId: null,
        walletId: "wal_bank",
      },
    ],
    budgets: [
      {
        id: "bud_1",
        categoryId: "cat_food",
        monthlyLimitMinor: 50000,
      },
    ],
    recurringItems: [
      {
        id: "rec_1",
        amountMinor: 2000,
        description: "Bus pass",
        type: "EXPENSE",
        categoryId: "cat_transport",
        dayOfMonth: 1,
        active: true,
        startDate: null,
        endDate: null,
        lastGeneratedMonth: null,
      },
    ],
    wallets: [
      {
        id: "wal_cash",
        name: "Pocket cash",
        type: "Cash",
        openingBalanceMinor: 5000,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "wal_bank",
        name: "Main bank",
        type: "Bank",
        openingBalanceMinor: 100000,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    transfers: [
      {
        id: "xfer_1",
        fromWalletId: "wal_bank",
        toWalletId: "wal_cash",
        amountMinor: 2000,
        note: "ATM",
        date: "2026-11-02T00:00:00.000Z",
        createdAt: "2026-11-02T00:00:00.000Z",
      },
    ],
    goals: [
      {
        id: "goal_1",
        name: "Emergency fund",
        targetAmountMinor: 500000,
        savedAmountMinor: 50000,
        deadline: "2027-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };

  return { ...base, ...overrides };
}

describe("backup helpers", () => {
  it("names backup files with the date stamp", () => {
    expect(backupFileName(new Date("2026-11-17T15:00:00.000Z"))).toBe(
      "expense-tracker-backup-2026-11-17.zip",
    );
  });

  it("rejects path traversal in receipt zip paths", () => {
    expect(sanitizeReceiptZipPath("receipts/ok.jpg")).toBe("receipts/ok.jpg");
    expect(sanitizeReceiptZipPath("receipts/../secret.jpg")).toBeNull();
    expect(sanitizeReceiptZipPath("uploads/ok.jpg")).toBeNull();
    expect(sanitizeReceiptZipPath("receipts/nested/ok.jpg")).toBeNull();
    expect(sanitizeReceiptZipPath("receipts/ok.gif")).toBeNull();
  });

  it("flags backup reminder after 30 days or when never backed up", () => {
    expect(isBackupReminderDue(null)).toBe(true);
    expect(isBackupReminderDue(new Date())).toBe(false);
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    expect(isBackupReminderDue(old)).toBe(true);
  });
});

describe("backup zip round trip", () => {
  it("creates a zip and restores the same structure and receipt bytes", () => {
    const data = sampleBackup();
    const receiptFiles = new Map<string, Uint8Array>([
      ["receipts/lunch.jpg", jpegBytes],
    ]);

    const zipBytes = buildBackupZip(data, receiptFiles);
    const parsed = parseBackupZip(zipBytes);

    expect(parsed.preview).toEqual({
      categories: 2,
      expenses: 1,
      incomes: 1,
      budgets: 1,
      receipts: 1,
      recurringItems: 1,
      wallets: 2,
      transfers: 1,
      goals: 1,
      createdAt: data.createdAt,
      formatVersion: BACKUP_FORMAT_VERSION,
    });
    expect(parsed.data.settings.baseCurrency).toBe("PKR");
    expect(parsed.data.settings.exchangeRates.USD).toBe(280);
    expect(parsed.data.categories.map((c) => c.name)).toEqual([
      "Food",
      "Transport",
    ]);
    expect(parsed.data.expenses[0]?.description).toBe("Lunch");
    expect(parsed.data.expenses[0]?.walletId).toBe("wal_cash");
    expect(parsed.data.incomes[0]?.walletId).toBe("wal_bank");
    expect(parsed.data.wallets.map((w) => w.name)).toEqual([
      "Pocket cash",
      "Main bank",
    ]);
    expect(parsed.data.transfers[0]?.fromWalletId).toBe("wal_bank");
    expect(parsed.data.transfers[0]?.toWalletId).toBe("wal_cash");
    expect(parsed.data.goals[0]?.name).toBe("Emergency fund");
    expect(parsed.data.expenses[0]?.receipt?.receiptFile).toBe(
      "receipts/lunch.jpg",
    );
    expect(Array.from(parsed.receipts.get("receipts/lunch.jpg") ?? [])).toEqual(
      Array.from(jpegBytes),
    );
  });
});

describe("legacy format version 1 backup", () => {
  it("accepts old backups without wallets, transfers, or goals", () => {
    const legacy = {
      formatVersion: BACKUP_FORMAT_VERSION_LEGACY,
      createdAt: "2026-10-01T12:00:00.000Z",
      settings: {
        baseCurrency: "PKR",
        exchangeRates: { USD: 280 },
      },
      categories: [
        { id: "cat_food", name: "Food", createdAt: "2026-01-01T00:00:00.000Z" },
      ],
      expenses: [
        {
          id: "exp_1",
          amountMinor: 1500,
          currency: "PKR",
          convertedAmountMinor: 1500,
          exchangeRateUsed: 1,
          description: "Lunch",
          date: "2026-11-01T00:00:00.000Z",
          categoryId: "cat_food",
          paymentMethod: "Cash",
          notes: "",
          tags: ["food"],
          recurringExpenseId: null,
          receipt: {
            fileName: "lunch.jpg",
            mimeType: "image/jpeg",
            sizeBytes: jpegBytes.byteLength,
            receiptFile: "receipts/lunch.jpg",
          },
        },
      ],
      incomes: [
        {
          id: "inc_1",
          amountMinor: 100000,
          currency: "PKR",
          convertedAmountMinor: 100000,
          exchangeRateUsed: 1,
          source: "Salary",
          description: "November",
          date: "2026-11-01T00:00:00.000Z",
          recurringExpenseId: null,
        },
      ],
      budgets: [
        {
          id: "bud_1",
          categoryId: "cat_food",
          monthlyLimitMinor: 50000,
        },
      ],
      recurringItems: [],
    };

    const zip = zipSync({
      "data.json": strToU8(JSON.stringify(legacy)),
      "receipts/lunch.jpg": jpegBytes,
    });
    const parsed = parseBackupZip(zip);

    expect(parsed.data.formatVersion).toBe(BACKUP_FORMAT_VERSION_LEGACY);
    expect(parsed.data.wallets).toEqual([]);
    expect(parsed.data.transfers).toEqual([]);
    expect(parsed.data.goals).toEqual([]);
    expect(parsed.data.expenses[0]?.walletId).toBeNull();
    expect(parsed.data.incomes[0]?.walletId).toBeNull();
    expect(parsed.preview).toMatchObject({
      categories: 1,
      expenses: 1,
      incomes: 1,
      budgets: 1,
      receipts: 1,
      recurringItems: 0,
      wallets: 0,
      transfers: 0,
      goals: 0,
      formatVersion: BACKUP_FORMAT_VERSION_LEGACY,
    });
  });
});

describe("tampered backup rejection", () => {
  it("rejects an unsupported format version", () => {
    const bad = sampleBackup({
      formatVersion: 999 as unknown as typeof BACKUP_FORMAT_VERSION,
    });
    const zip = buildBackupZip(bad, new Map());
    expect(() => parseBackupZip(zip)).toThrow(/Invalid backup data/i);
  });

  it("rejects when a referenced receipt file is missing", () => {
    const data = sampleBackup();
    const zip = buildBackupZip(data, new Map());
    expect(() => parseBackupZip(zip)).toThrow(/Missing receipt file/i);
  });

  it("rejects path traversal receipt entries in the zip", () => {
    const data = sampleBackup({
      expenses: [
        {
          id: "exp_1",
          amountMinor: 100,
          currency: "PKR",
          convertedAmountMinor: 100,
          exchangeRateUsed: 1,
          description: "Hack",
          date: "2026-11-01T00:00:00.000Z",
          categoryId: "cat_food",
          paymentMethod: "Cash",
          notes: "",
          tags: [],
          walletId: null,
          receipt: null,
        },
      ],
    });
    const files = {
      "data.json": strToU8(JSON.stringify(data)),
      "receipts/../evil.jpg": jpegBytes,
    };
    const zip = zipSync(files);
    expect(() => parseBackupZip(zip)).toThrow(/Unsafe or invalid receipt path/i);
  });

  it("rejects receipt bytes that do not match the declared mime type", () => {
    const data = sampleBackup();
    const zip = buildBackupZip(
      data,
      new Map([["receipts/lunch.jpg", strToU8("not-a-jpeg")]]),
    );
    expect(() => parseBackupZip(zip)).toThrow(
      /do not match|magic bytes|contents/i,
    );
  });

  it("rejects unknown category references", () => {
    const data = sampleBackup({
      expenses: [
        {
          id: "exp_bad",
          amountMinor: 100,
          currency: "PKR",
          convertedAmountMinor: 100,
          exchangeRateUsed: 1,
          description: "Orphan",
          date: "2026-11-01T00:00:00.000Z",
          categoryId: "missing_cat",
          paymentMethod: "Cash",
          notes: "",
          tags: [],
          walletId: null,
          receipt: null,
        },
      ],
    });
    const zip = buildBackupZip(data, new Map());
    expect(() => parseBackupZip(zip)).toThrow(/Unknown categoryId/i);
  });

  it("rejects unknown wallet references on expenses", () => {
    const data = sampleBackup({
      expenses: [
        {
          id: "exp_bad",
          amountMinor: 100,
          currency: "PKR",
          convertedAmountMinor: 100,
          exchangeRateUsed: 1,
          description: "Orphan wallet",
          date: "2026-11-01T00:00:00.000Z",
          categoryId: "cat_food",
          paymentMethod: "Cash",
          notes: "",
          tags: [],
          walletId: "missing_wallet",
          receipt: null,
        },
      ],
    });
    const zip = buildBackupZip(data, new Map());
    expect(() => parseBackupZip(zip)).toThrow(/Unknown walletId/i);
  });
});
