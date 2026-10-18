-- The spreadsheet is authoritative for these three rows, but prisma/import.ts
-- only ever creates, so it added the sheet's values alongside the old ones
-- instead of replacing them. This removes the superseded links.
--
--   npx prisma db execute --file prisma/sheet-corrections.sql
--
-- Safe to run twice: each DELETE is a no-op once it has been applied.

DELETE FROM "SystemCpu"
WHERE "systemId" = (SELECT "id" FROM "System" WHERE "name" = 'Lenovo ThinkStation P3 Ultra SFF Gen 2')
  AND "cpuId"    = (SELECT "id" FROM "Cpu"    WHERE "name" = 'Intel Core Ultra 7 265');

DELETE FROM "SystemStorage"
WHERE "systemId"        = (SELECT "id" FROM "System"        WHERE "name" = 'Dell XPS Desktop')
  AND "storageConfigId" = (SELECT "id" FROM "StorageConfig" WHERE "capacityGb" = 1000);

DELETE FROM "SystemStorage"
WHERE "systemId"        = (SELECT "id" FROM "System"        WHERE "name" = 'Minisforum UM890 Pro')
  AND "storageConfigId" = (SELECT "id" FROM "StorageConfig" WHERE "capacityGb" = 512);

-- Sheet says this one is still sold. updatedAt is set by hand because
-- @updatedAt is applied by the Prisma client, not by the database.
UPDATE "System" SET "active" = true, "updatedAt" = now()
WHERE "name" = 'Dell XPS Desktop';
