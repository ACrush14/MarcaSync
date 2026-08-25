import { defineConfig } from "prisma/config";

// Config do Prisma 7 (modelo "no rust engine" — a conexão não vive mais no
// schema.prisma, vive aqui). O caminho abaixo é relativo à raiz do projeto
// (onde este arquivo mora), por isso "./prisma/dev.db" e não "./dev.db" —
// senão o Prisma cria o banco solto na raiz. Local, SQLite, um arquivo só —
// ver nota no topo de prisma/schema.prisma sobre quando migrar pra Postgres.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: "file:./prisma/dev.db",
  },
});
