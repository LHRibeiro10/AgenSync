ALTER TABLE "User"
  ALTER COLUMN "platformRole" SET DEFAULT 'USER';

UPDATE "User"
SET "platformRole" = 'USER'
WHERE "platformRole" IS NULL;

CREATE TYPE "AccountOperationalStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');
CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "User"
  ADD COLUMN "platformPlan" TEXT,
  ADD COLUMN "accountStatus" "AccountOperationalStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "userStatus" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "temporaryAccessUntil" TIMESTAMP(3);

CREATE INDEX "User_platformPlan_idx" ON "User"("platformPlan");
CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");
CREATE INDEX "User_userStatus_idx" ON "User"("userStatus");
