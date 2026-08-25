import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Singleton do Prisma Client, padrão recomendado pra Next.js: em dev, o hot
// reload recriaria uma conexão nova a cada edição de arquivo se não
// guardássemos a instância em `globalThis` — SQLite não aguenta múltiplas
// conexões de escrita concorrentes.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
