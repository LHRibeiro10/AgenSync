-- CreateEnum
CREATE TYPE "AppointmentKind" AS ENUM ('APPOINTMENT', 'PERSONAL_BLOCK');

-- AlterTable
ALTER TABLE "Appointment"
  ADD COLUMN "kind" "AppointmentKind" NOT NULL DEFAULT 'APPOINTMENT',
  ADD COLUMN "title" TEXT,
  ALTER COLUMN "clientId" DROP NOT NULL,
  ALTER COLUMN "serviceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Appointment_workspaceId_kind_startsAt_idx" ON "Appointment"("workspaceId", "kind", "startsAt");
