import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Creates (or updates the password of) the single teacher account. Read from
 * the environment so a live database never gets a password published here.
 */
async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "teacher@example.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "password";
  const name = process.env.ADMIN_NAME ?? "Teacher";

  if (!process.env.ADMIN_PASSWORD && process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to seed a production database with the default password. " +
        "Set ADMIN_EMAIL and ADMIN_PASSWORD.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.teacher.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, name, passwordHash },
  });

  console.log(`Teacher account ready: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
