CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'PROFESSIONAL');
CREATE TYPE "PlatformRole" AS ENUM ('SUPPORT', 'DEVELOPER', 'PLATFORM_OWNER');
CREATE TYPE "AccountSubscriptionStatus" AS ENUM ('PAID', 'TRIAL', 'PAST_DUE', 'CANCELED');

ALTER TABLE "User"
  ADD COLUMN "workspaceRole" "WorkspaceRole" NOT NULL DEFAULT 'OWNER',
  ADD COLUMN "platformRole" "PlatformRole",
  ADD COLUMN "subscriptionStatus" "AccountSubscriptionStatus" NOT NULL DEFAULT 'PAID',
  ADD COLUMN "subscriptionPaidUntil" TIMESTAMP(3),
  ADD COLUMN "billingEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET
  "workspaceRole" = CASE WHEN "role" = 'ADMIN' THEN 'OWNER'::"WorkspaceRole" ELSE 'OWNER'::"WorkspaceRole" END,
  "subscriptionStatus" = 'PAID'::"AccountSubscriptionStatus",
  "billingEnabled" = false
WHERE "workspaceRole" IS NOT NULL;

CREATE INDEX "User_workspaceRole_idx" ON "User"("workspaceRole");
CREATE INDEX "User_platformRole_idx" ON "User"("platformRole");
CREATE INDEX "User_subscriptionStatus_idx" ON "User"("subscriptionStatus");
