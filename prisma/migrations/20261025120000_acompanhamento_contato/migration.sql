-- AlterTable
ALTER TABLE "Processo" ADD COLUMN     "anotacoes" TEXT,
ADD COLUMN     "interesse" TEXT NOT NULL DEFAULT 'novo',
ADD COLUMN     "proximoContatoEm" TIMESTAMP(3),
ADD COLUMN     "ultimoContatoEm" TIMESTAMP(3);
