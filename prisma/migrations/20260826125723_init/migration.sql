-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Processo" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "nclCode" TEXT,
    "nclLabel" TEXT,
    "riscoPct" INTEGER,
    "riscoFonte" TEXT,
    "monitoramento" BOOLEAN NOT NULL DEFAULT false,
    "protocolo" TEXT,
    "numeroProcesso" TEXT,
    "status" TEXT NOT NULL DEFAULT 'consulta',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "confirmadoEm" TIMESTAMP(3),
    "confirmadoVia" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_whatsapp_key" ON "Cliente"("whatsapp");

-- AddForeignKey
ALTER TABLE "Processo" ADD CONSTRAINT "Processo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
