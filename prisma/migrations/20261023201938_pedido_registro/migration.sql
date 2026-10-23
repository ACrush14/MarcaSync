-- CreateTable
CREATE TABLE "PedidoRegistro" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "tipoRequerente" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "participaEmpresaDoRamo" BOOLEAN NOT NULL DEFAULT false,
    "nome" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "apresentacao" TEXT NOT NULL,
    "elementoNominativo" TEXT,
    "classeNice" TEXT NOT NULL,
    "especificacao" TEXT NOT NULL,
    "atividade" TEXT NOT NULL,
    "servicoCentavos" INTEGER NOT NULL,
    "gruCentavos" INTEGER NOT NULL,
    "gruComDesconto" BOOLEAN NOT NULL,
    "aceitoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PedidoRegistro_processoId_key" ON "PedidoRegistro"("processoId");

-- AddForeignKey
ALTER TABLE "PedidoRegistro" ADD CONSTRAINT "PedidoRegistro_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
