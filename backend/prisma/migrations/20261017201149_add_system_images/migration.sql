-- CreateTable
CREATE TABLE "SystemImage" (
    "id" SERIAL NOT NULL,
    "systemId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemImage_systemId_idx" ON "SystemImage"("systemId");

-- AddForeignKey
ALTER TABLE "SystemImage" ADD CONSTRAINT "SystemImage_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
