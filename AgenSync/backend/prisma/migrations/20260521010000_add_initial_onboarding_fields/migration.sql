ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "businessTypeCustom" TEXT,
  ADD COLUMN IF NOT EXISTS "businessPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "businessCity" TEXT,
  ADD COLUMN IF NOT EXISTS "businessAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "professionalId" TEXT;

ALTER TABLE "Professional"
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "monthlyGoal" DECIMAL(10, 2);

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "email" TEXT;

UPDATE "User" AS u
SET
  "onboardingCompleted" = true,
  "onboardingCompletedAt" = COALESCE(u."onboardingCompletedAt", u."createdAt")
WHERE u."onboardingCompleted" = false
  AND (
    EXISTS (SELECT 1 FROM "Service" AS s WHERE s."userId" = u.id)
    OR EXISTS (SELECT 1 FROM "Professional" AS p WHERE p."userId" = u.id)
    OR EXISTS (SELECT 1 FROM "Client" AS c WHERE c."userId" = u.id)
    OR EXISTS (SELECT 1 FROM "Appointment" AS a WHERE a."userId" = u.id)
  );

UPDATE "User" AS u
SET "professionalId" = p.id
FROM (
  SELECT DISTINCT ON ("userId") "userId", id
  FROM "Professional"
  ORDER BY "userId", "createdAt" ASC
) AS p
WHERE u.id = p."userId"
  AND u."professionalId" IS NULL;

CREATE INDEX IF NOT EXISTS "User_onboardingCompleted_idx" ON "User"("onboardingCompleted");
CREATE INDEX IF NOT EXISTS "User_professionalId_idx" ON "User"("professionalId");
CREATE INDEX IF NOT EXISTS "Professional_userId_email_idx" ON "Professional"("userId", "email");
CREATE INDEX IF NOT EXISTS "Client_userId_email_idx" ON "Client"("userId", "email");
