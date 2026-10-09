-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "pagina" TEXT,
    "origem" TEXT,
    "dados" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evento_nome_createdAt_idx" ON "Evento"("nome", "createdAt");

-- CreateIndex
CREATE INDEX "Evento_sessaoId_idx" ON "Evento"("sessaoId");