-- CreateTable
CREATE TABLE "Prazo" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "venceEm" TIMESTAMP(3) NOT NULL,
    "concluidoEm" TIMESTAMP(3),
    "ultimoAvisoDias" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prazo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "processoId" TEXT,
    "destino" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "enviadaEm" TIMESTAMP(3),
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReciboProtocolo" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "pdf" BYTEA NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReciboProtocolo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prazo_venceEm_idx" ON "Prazo"("venceEm");

-- CreateIndex
CREATE INDEX "Notificacao_processoId_idx" ON "Notificacao"("processoId");

-- CreateIndex
CREATE UNIQUE INDEX "ReciboProtocolo_processoId_key" ON "ReciboProtocolo"("processoId");

-- AddForeignKey
ALTER TABLE "Prazo" ADD CONSTRAINT "Prazo_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReciboProtocolo" ADD CONSTRAINT "ReciboProtocolo_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
