-- CreateTable
CREATE TABLE "MarcaInpi" (
    "numero" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "situacao" TEXT NOT NULL,
    "deposito" DATE,
    "classes" TEXT,
    "lote" INTEGER NOT NULL,

    CONSTRAINT "MarcaInpi_pkey" PRIMARY KEY ("numero")
);

-- CreateTable
CREATE TABLE "IngestaoMarcas" (
    "lote" INTEGER NOT NULL,
    "concluidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" INTEGER NOT NULL,
    "fonteAtualizada" TEXT,

    CONSTRAINT "IngestaoMarcas_pkey" PRIMARY KEY ("lote")
);

-- CreateIndex
CREATE INDEX "MarcaInpi_chave_idx" ON "MarcaInpi"("chave" text_pattern_ops);
