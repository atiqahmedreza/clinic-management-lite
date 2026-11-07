import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 6 no longer auto-loads `.env` when a config file is present, so we do
// it ourselves. Next.js loads `.env` on its own at runtime; this is only for
// the Prisma CLI (migrate / db push / studio / seed).
const envFile = path.join(process.cwd(), ".env");
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
