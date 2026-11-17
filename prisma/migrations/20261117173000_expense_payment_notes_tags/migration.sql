-- CreateTable
CREATE TABLE IF NOT EXISTS "Income" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "convertedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "exchangeRateUsed" REAL NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "date" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Income_userId_idx" ON "Income"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Income_userId_date_idx" ON "Income"("userId", "date");

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'Cash';
ALTER TABLE "Expense" ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Expense" ADD COLUMN "tags" JSON NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "Expense_userId_paymentMethod_idx" ON "Expense"("userId", "paymentMethod");
