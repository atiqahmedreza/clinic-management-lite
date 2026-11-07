import { PrismaClient } from "@prisma/client";

/**
 * A single PrismaClient is shared across the process. In development Next.js
 * hot-reloads modules, which would otherwise open a new pool on every edit and
 * exhaust the database connection limit, so we cache the instance on
 * `globalThis`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
