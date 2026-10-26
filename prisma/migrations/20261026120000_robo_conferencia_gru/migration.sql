-- CreateTable
CREATE TABLE "ConferenciaGru" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "servico" TEXT NOT NULL,
    "esperadoCentavos" INTEGER NOT NULL,
    "lidoCentavos" INTEGER,
    "resultado" TEXT NOT NULL,
    "detalhe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConferenciaGru_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoboEstado" (
    "id" TEXT NOT NULL,
    "vistoEm" TIMESTAMP(3) NOT NULL,
    "sessao" TEXT NOT NULL,
    "detalhe" TEXT,

    CONSTRAINT "RoboEstado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConferenciaGru_processoId_createdAt_idx" ON "ConferenciaGru"("processoId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConferenciaGru" ADD CONSTRAINT "ConferenciaGru_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
