import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Config do Prisma 7 (modelo "no rust engine" — a conexão não vive mais no
// schema.prisma, vive aqui). DATABASE_URL_UNPOOLED, não DATABASE_URL:
// migrações precisam de conexão direta com o Postgres, sem passar pelo
// pooler do Neon (PgBouncer não suporta todas as operações que
// `prisma migrate` usa). Nome da variável é o que a integração
// Vercel+Neon já cria sozinha (Storage → Postgres) — não inventei um nome
// novo de propósito, pra não precisar configurar nada extra no Vercel. O
// app em runtime usa DATABASE_URL (pooled) — ver src/lib/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL_UNPOOLED"),
  },
});
