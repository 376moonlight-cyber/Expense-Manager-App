-- Per-user categories: clone each shared category for every user, then remap FKs.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Clone shared categories onto each account (stable new id = oldId_userId).
INSERT INTO "new_Category" ("id", "name", "userId", "createdAt")
SELECT c."id" || '_' || u."id", c."name", u."id", c."createdAt"
FROM "Category" c
CROSS JOIN "User" u;

-- Remap expense / budget / recurring FKs to the per-user clone.
UPDATE "Expense"
SET "categoryId" = "categoryId" || '_' || "userId"
WHERE EXISTS (
  SELECT 1 FROM "Category" AS c WHERE c."id" = "Expense"."categoryId"
);

UPDATE "Budget"
SET "categoryId" = "categoryId" || '_' || "userId"
WHERE EXISTS (
  SELECT 1 FROM "Category" AS c WHERE c."id" = "Budget"."categoryId"
);

UPDATE "RecurringExpense"
SET "categoryId" = "categoryId" || '_' || "userId"
WHERE "categoryId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Category" AS c WHERE c."id" = "RecurringExpense"."categoryId"
  );

DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";

CREATE INDEX "Category_userId_idx" ON "Category"("userId");
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
