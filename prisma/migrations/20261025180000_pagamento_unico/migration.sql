-- AlterTable
ALTER TABLE "Pagamento" ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "devolvidoCentavos" INTEGER NOT NULL DEFAULT 0;
