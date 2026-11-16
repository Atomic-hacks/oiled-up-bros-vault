import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // A placeholder keeps `prisma generate` and schema validation usable before
    // the private Supabase values are added. Migrations use DIRECT_URL.
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/vault",
  },
});
