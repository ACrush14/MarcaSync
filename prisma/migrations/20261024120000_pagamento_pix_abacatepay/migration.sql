-- AlterTable
ALTER TABLE "Pagamento" ADD COLUMN     "brCode" TEXT,
ADD COLUMN     "estornadoEm" TIMESTAMP(3),
ADD COLUMN     "estornoId" TEXT,
ADD COLUMN     "expiraEm" TIMESTAMP(3),
ADD COLUMN     "provedorId" TEXT;

-- AlterTable
ALTER TABLE "Processo" ADD COLUMN     "gruPagaInpiEm" TIMESTAMP(3),
ADD COLUMN     "protocoladoEm" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_provedorId_key" ON "Pagamento"("provedorId");
