-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Processo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "nclCode" TEXT,
    "nclLabel" TEXT,
    "riscoPct" INTEGER,
    "monitoramento" BOOLEAN NOT NULL DEFAULT false,
    "protocolo" TEXT,
    "numeroProcesso" TEXT,
    "status" TEXT NOT NULL DEFAULT 'consulta',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Processo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "confirmadoEm" DATETIME,
    "confirmadoVia" TEXT,
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pagamento_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_whatsapp_key" ON "Cliente"("whatsapp");
