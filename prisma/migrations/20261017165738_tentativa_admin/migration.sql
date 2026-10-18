
-- CreateTable
CREATE TABLE "TentativaAdmin" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TentativaAdmin_ip_createdAt_idx" ON "TentativaAdmin"("ip", "createdAt");
