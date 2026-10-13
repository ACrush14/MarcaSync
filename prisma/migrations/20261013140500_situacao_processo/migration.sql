

-- AlterTable
ALTER TABLE "Alerta" ADD COLUMN     "origem" TEXT NOT NULL DEFAULT 'rpi',
ADD COLUMN     "situacaoNova" TEXT,
ALTER COLUMN "edicao" DROP NOT NULL,
ALTER COLUMN "despachoCodigo" DROP NOT NULL,
ALTER COLUMN "despachoNome" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Processo" ADD COLUMN     "situacaoInpi" TEXT,
ADD COLUMN     "situacaoVerificadaEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SituacaoProcesso" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "situacao" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "vistaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SituacaoProcesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SituacaoProcesso_processoId_vistaEm_idx" ON "SituacaoProcesso"("processoId", "vistaEm");


-- AddForeignKey
ALTER TABLE "SituacaoProcesso" ADD CONSTRAINT "SituacaoProcesso_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
