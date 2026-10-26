-- CreateTable
CREATE TABLE "GeracaoLogo" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "estilo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeracaoLogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeracaoLogo_processoId_idx" ON "GeracaoLogo"("processoId");

-- CreateIndex
CREATE INDEX "GeracaoLogo_createdAt_idx" ON "GeracaoLogo"("createdAt");

-- AddForeignKey
ALTER TABLE "GeracaoLogo" ADD CONSTRAINT "GeracaoLogo_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
