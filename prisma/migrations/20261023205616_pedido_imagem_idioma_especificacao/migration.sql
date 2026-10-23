-- AlterTable
ALTER TABLE "PedidoRegistro" ADD COLUMN     "especificacaoItens" TEXT[],
ADD COLUMN     "especificacaoLivre" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "palavraEstrangeira" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "traducao" TEXT;

-- CreateTable
CREATE TABLE "ImagemMarca" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "jpg" BYTEA NOT NULL,
    "original" BYTEA NOT NULL,
    "mimeOriginal" TEXT NOT NULL,
    "larguraOriginal" INTEGER NOT NULL,
    "alturaOriginal" INTEGER NOT NULL,
    "largura" INTEGER NOT NULL,
    "altura" INTEGER NOT NULL,
    "ampliada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImagemMarca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImagemMarca_processoId_key" ON "ImagemMarca"("processoId");

-- AddForeignKey
ALTER TABLE "ImagemMarca" ADD CONSTRAINT "ImagemMarca_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
