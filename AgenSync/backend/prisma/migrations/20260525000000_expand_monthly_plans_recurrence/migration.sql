ALTER TYPE "MonthlyPlanStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TYPE "MonthlyPaymentStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';
ALTER TYPE "MonthlyPaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELED';

DO $$ BEGIN
  CREATE TYPE "MonthlyBillingType" AS ENUM ('PER_COMPLETED_SESSION', 'FIXED_MONTHLY', 'PACKAGE_MONTHLY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MonthlyPriceMode" AS ENUM ('SERVICE_PRICE', 'CUSTOM_SESSION_PRICE', 'MONTHLY_PRICE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MonthlyRecurrenceType" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'WEEKDAYS', 'EVERY_X_DAYS', 'MANUAL_DATES');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "MonthlyPlan"
ADD COLUMN IF NOT EXISTS "serviceId" TEXT,
ADD COLUMN IF NOT EXISTS "professionalId" TEXT,
ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "billingType" "MonthlyBillingType" NOT NULL DEFAULT 'FIXED_MONTHLY',
ADD COLUMN IF NOT EXISTS "priceMode" "MonthlyPriceMode" NOT NULL DEFAULT 'MONTHLY_PRICE',
ADD COLUMN IF NOT EXISTS "monthlyPrice" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "sessionPrice" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "sessionsPerMonth" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "recurrenceType" "MonthlyRecurrenceType" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN IF NOT EXISTS "recurrenceConfig" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "defaultStartTime" TEXT,
ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER,
ADD COLUMN IF NOT EXISTS "generateAppointments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "generatedUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);

UPDATE "MonthlyPlan"
SET "monthlyPrice" = COALESCE("monthlyPrice", "amount"),
    "sessionPrice" = COALESCE("sessionPrice", "amount")
WHERE "monthlyPrice" IS NULL OR "sessionPrice" IS NULL;

ALTER TABLE "MonthlyPlanPayment"
ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT,
ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "monthlyPlanId" TEXT;

DO $$ BEGIN
  ALTER TABLE "MonthlyPlan"
  ADD CONSTRAINT "MonthlyPlan_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MonthlyPlan"
  ADD CONSTRAINT "MonthlyPlan_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_monthlyPlanId_fkey"
  FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "MonthlyPlan_userId_serviceId_idx" ON "MonthlyPlan"("userId", "serviceId");
CREATE INDEX IF NOT EXISTS "MonthlyPlan_userId_professionalId_idx" ON "MonthlyPlan"("userId", "professionalId");
CREATE INDEX IF NOT EXISTS "MonthlyPlan_userId_billingType_idx" ON "MonthlyPlan"("userId", "billingType");
CREATE INDEX IF NOT EXISTS "MonthlyPlanPayment_dueDate_status_idx" ON "MonthlyPlanPayment"("dueDate", "status");
CREATE INDEX IF NOT EXISTS "Appointment_userId_monthlyPlanId_startsAt_idx" ON "Appointment"("userId", "monthlyPlanId", "startsAt");
