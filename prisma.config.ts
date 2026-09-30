import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI-only (migrate/seed). Neon's pooled DATABASE_URL can't hold the
    // advisory lock `migrate deploy` takes, so prefer the unpooled URL the
    // Vercel integration also sets. Locally there is no pooler.
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
