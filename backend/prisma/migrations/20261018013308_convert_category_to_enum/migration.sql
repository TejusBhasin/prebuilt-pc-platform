--AlterTable
ALTER TABLE "System" ALTER COLUMN "category" TYPE "Category" USING "category"::"Category";

-- DropForeignKey
ALTER TABLE "SystemCpu" DROP CONSTRAINT "SystemCpu_cpuId_fkey";
ALTER TABLE "SystemCpu" DROP CONSTRAINT "SystemCpu_systemId_fkey";
ALTER TABLE "SystemGpu" DROP CONSTRAINT "SystemGpu_gpuId_fkey";
ALTER TABLE "SystemGpu" DROP CONSTRAINT "SystemGpu_systemId_fkey";
ALTER TABLE "SystemImage" DROP CONSTRAINT "SystemImage_systemId_fkey";
ALTER TABLE "SystemRam" DROP CONSTRAINT "SystemRam_ramConfigId_fkey";
ALTER TABLE "SystemRam" DROP CONSTRAINT "SystemRam_systemId_fkey";
ALTER TABLE "SystemStorage" DROP CONSTRAINT "SystemStorage_storageConfigId_fkey";
ALTER TABLE "SystemStorage" DROP CONSTRAINT "SystemStorage_systemId_fkey";

-- AddForeignKey
ALTER TABLE "SystemImage" ADD CONSTRAINT "SystemImage_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SystemCpu" ADD CONSTRAINT "SystemCpu_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SystemCpu" ADD CONSTRAINT "SystemCpu_cpuId_fkey" FOREIGN KEY ("cpuId") REFERENCES "Cpu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SystemGpu" ADD CONSTRAINT "SystemGpu_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SystemGpu" ADD CONSTRAINT "SystemGpu_gpuId_fkey" FOREIGN KEY ("gpuId") REFERENCES "Gpu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SystemRam" ADD CONSTRAINT "SystemRam_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SystemRam" ADD CONSTRAINT "SystemRam_ramConfigId_fkey" FOREIGN KEY ("ramConfigId") REFERENCES "RamConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SystemStorage" ADD CONSTRAINT "SystemStorage_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SystemStorage" ADD CONSTRAINT "SystemStorage_storageConfigId_fkey" FOREIGN KEY ("storageConfigId") REFERENCES "StorageConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
