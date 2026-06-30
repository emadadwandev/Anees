-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('fall_sensor', 'sleep_sensor');

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "device_type" "DeviceType" NOT NULL DEFAULT 'fall_sensor';
