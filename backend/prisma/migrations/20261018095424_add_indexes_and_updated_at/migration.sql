-- AlterTable
-- Each updatedAt is added WITH a default so existing rows satisfy NOT NULL, then
-- the default is dropped: @updatedAt declares no database default (the Prisma
-- client supplies the value), so a lingering default would read as drift on
-- every later migrate diff. Prisma generates a bare "ADD COLUMN ... NOT NULL"
-- here, which fails with 23502 on any table that already has rows.
ALTER TABLE "Cpu" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Cpu" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Gpu" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Gpu" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Manufacturer" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Manufacturer" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "RamConfig" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RamConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "StorageConfig" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "StorageConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "System" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "System" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "SystemImage" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SystemImage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Cpu_manufacturerId_idx" ON "Cpu"("manufacturerId");
CREATE INDEX "Gpu_manufacturerId_idx" ON "Gpu"("manufacturerId");
CREATE INDEX "System_manufacturerId_idx" ON "System"("manufacturerId");
CREATE INDEX "System_category_idx" ON "System"("category");
CREATE INDEX "SystemCpu_systemId_idx" ON "SystemCpu"("systemId");
CREATE INDEX "SystemCpu_cpuId_idx" ON "SystemCpu"("cpuId");
CREATE INDEX "SystemGpu_systemId_idx" ON "SystemGpu"("systemId");
CREATE INDEX "SystemGpu_gpuId_idx" ON "SystemGpu"("gpuId");
CREATE INDEX "SystemRam_systemId_idx" ON "SystemRam"("systemId");
CREATE INDEX "SystemRam_ramConfigId_idx" ON "SystemRam"("ramConfigId");
CREATE INDEX "SystemStorage_systemId_idx" ON "SystemStorage"("systemId");
CREATE INDEX "SystemStorage_storageConfigId_idx" ON "SystemStorage"("storageConfigId");
CREATE INDEX "QuestionOption_questionId_idx" ON "QuestionOption"("questionId");
