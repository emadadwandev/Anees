-- Add the operator role without changing existing role values.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'super_admin';

CREATE TYPE "DeviceManagementState" AS ENUM ('enabled', 'maintenance', 'disabled');

ALTER TABLE "devices" DROP CONSTRAINT IF EXISTS "devices_user_id_fkey";
ALTER TABLE "devices" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "devices"
  ADD COLUMN "management_state" "DeviceManagementState" NOT NULL DEFAULT 'enabled',
  ADD COLUMN "management_state_reason" TEXT,
  ADD COLUMN "management_state_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deprovisioned_at" TIMESTAMP(3);

CREATE INDEX "devices_management_state_deprovisioned_at_idx"
  ON "devices"("management_state", "deprovisioned_at");

CREATE INDEX "devices_user_id_status_idx"
  ON "devices"("user_id", "status");
