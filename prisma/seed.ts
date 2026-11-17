import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Bills",
  "Shopping",
  "Health",
  "Other",
] as const;

/**
 * Demo account for local / staging (password: password123).
 * Skip in production by setting SEED_DEMO_USER=false.
 */
const DEMO_USER = {
  email: "demo@example.com",
  name: "Demo User",
  password: "password123",
} as const;

async function main() {
  // Categories are shared (no userId) so every account uses the same list.
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log(`Seeded ${DEFAULT_CATEGORIES.length} shared categories.`);

  const seedDemo = process.env.SEED_DEMO_USER !== "false";
  if (!seedDemo) {
    console.log("Skipped demo user (SEED_DEMO_USER=false).");
    return;
  }

  const passwordHash = await hash(DEMO_USER.password, 12);
  await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: { name: DEMO_USER.name, passwordHash },
    create: {
      email: DEMO_USER.email,
      name: DEMO_USER.name,
      passwordHash,
    },
  });

  console.log(`Seeded demo user ${DEMO_USER.email} / ${DEMO_USER.password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
