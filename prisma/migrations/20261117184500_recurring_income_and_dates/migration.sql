-- Recurring: EXPENSE | INCOME, optional start/end dates, nullable category for income.
-- Link generated Income rows to the recurring template for duplicate-safe generation.

-- RecurringExpense: rebuild so categoryId can be nullable and new columns exist.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_RecurringExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amountMinor" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EXPENSE',
    "categoryId" TEXT,
    "userId" TEXT NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "lastGeneratedMonth" TEXT,
    CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_RecurringExpense" (
    "id",
    "amountMinor",
    "description",
    "type",
    "categoryId",
    "userId",
    "dayOfMonth",
    "active",
    "startDate",
    "endDate",
    "lastGeneratedMonth"
)
SELECT
    "id",
    "amountMinor",
    "description",
    'EXPENSE',
    "categoryId",
    "userId",
    "dayOfMonth",
    "active",
    NULL,
    NULL,
    "lastGeneratedMonth"
FROM "RecurringExpense";

DROP TABLE "RecurringExpense";
ALTER TABLE "new_RecurringExpense" RENAME TO "RecurringExpense";

CREATE INDEX IF NOT EXISTS "RecurringExpense_userId_idx" ON "RecurringExpense"("userId");
CREATE INDEX IF NOT EXISTS "RecurringExpense_categoryId_idx" ON "RecurringExpense"("categoryId");
CREATE INDEX IF NOT EXISTS "RecurringExpense_userId_active_idx" ON "RecurringExpense"("userId", "active");
CREATE INDEX IF NOT EXISTS "RecurringExpense_userId_type_idx" ON "RecurringExpense"("userId", "type");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Income: optional link back to recurring template (no-op if column already exists on some envs).
ALTER TABLE "Income" ADD COLUMN "recurringExpenseId" TEXT;
CREATE INDEX IF NOT EXISTS "Income_recurringExpenseId_date_idx" ON "Income"("recurringExpenseId", "date");
