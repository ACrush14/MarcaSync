-- CreateTable
CREATE TABLE "Alerta" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "edicao" INTEGER NOT NULL,
    "dataEdicao" TIMESTAMP(3),
    "despachoCodigo" TEXT NOT NULL,
    "despachoNome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "prazoAte" TIMESTAMP(3),
    "avisadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeituraRpi" (
    "edicao" INTEGER NOT NULL,
    "lidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificados" INTEGER NOT NULL,
    "encontrados" INTEGER NOT NULL,

    CONSTRAINT "LeituraRpi_pkey" PRIMARY KEY ("edicao")
);

-- CreateIndex
CREATE INDEX "Alerta_avisadoEm_idx" ON "Alerta"("avisadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Alerta_processoId_edicao_despachoCodigo_key" ON "Alerta"("processoId", "edicao", "despachoCodigo");

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
