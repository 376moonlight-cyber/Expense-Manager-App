import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const [users, categories, expenses, budgets] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.expense.count(),
    prisma.budget.count(),
  ]);
  console.log({ users, categories, expenses, budgets });
} finally {
  await prisma.$disconnect();
}
