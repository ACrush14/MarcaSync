import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "@/generated/prisma/client";

// O driver serverless do Neon usa WebSocket (Pool interno) pra suportar
// transações interativas (o Prisma precisa disso — o modo HTTP do Neon,
// mais simples, não suporta transação de múltiplas queries). Fora do
// browser/edge, o Node.js não tem `WebSocket` global — por isso o polyfill
// via pacote `ws`. Sem isso, a primeira transação (não uma query solta)
// falharia em runtime Node.js.
neonConfig.webSocketConstructor = ws;

// Singleton do Prisma Client, padrão recomendado pra Next.js: em dev, o hot
// reload recriaria uma conexão nova a cada edição de arquivo se não
// guardássemos a instância em `globalThis`.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
