import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_CATEGORY_NAMES } from "../lib/categories";

const prisma = new PrismaClient();

/**
 * Demo account for local / staging (password: password123).
 * Skip in production by setting SEED_DEMO_USER=false.
 */
const DEMO_USER = {
  email: "demo@example.com",
  name: "Demo User",
  password: "password123",
} as const;

async function ensureUserCategories(userId: string) {
  for (const name of DEFAULT_CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { name, userId },
    });
  }
}

async function main() {
  const seedDemo = process.env.SEED_DEMO_USER !== "false";
  if (!seedDemo) {
    console.log("Skipped demo user (SEED_DEMO_USER=false).");
    // Still ensure any existing users have starter categories.
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      await ensureUserCategories(user.id);
    }
    console.log(
      `Ensured default categories for ${users.length} existing user(s).`,
    );
    return;
  }

  const passwordHash = await hash(DEMO_USER.password, 12);
  const demo = await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: { name: DEMO_USER.name, passwordHash },
    create: {
      email: DEMO_USER.email,
      name: DEMO_USER.name,
      passwordHash,
    },
  });

  await ensureUserCategories(demo.id);

  console.log(
    `Seeded demo user ${DEMO_USER.email} / ${DEMO_USER.password} with ${DEFAULT_CATEGORY_NAMES.length} categories.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
