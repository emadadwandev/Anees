-- CreateEnum
CREATE TYPE "DeviceTransport" AS ENUM ('mqtt', 'aerosense_tcp');

-- AlterTable
ALTER TABLE "devices"
  ADD COLUMN "transport" "DeviceTransport" NOT NULL DEFAULT 'mqtt',
  ADD COLUMN "vendor" TEXT,
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "capabilities" JSONB,
  ADD CONSTRAINT "devices_external_id_uppercase_check"
    CHECK ("external_id" IS NULL OR "external_id" = UPPER("external_id"));

-- CreateIndex
CREATE UNIQUE INDEX "devices_external_id_key" ON "devices"("external_id");
