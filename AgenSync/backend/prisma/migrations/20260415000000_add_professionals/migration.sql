CREATE TABLE "Professional" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Appointment" ADD COLUMN "professionalId" TEXT;

INSERT INTO "Professional" ("id", "userId", "name", "role", "isActive", "createdAt", "updatedAt")
SELECT 'prof_' || "id", "id", "name", 'Profissional principal', true, NOW(), NOW()
FROM "User";

UPDATE "Appointment"
SET "professionalId" = 'prof_' || "userId"
WHERE "professionalId" IS NULL;

CREATE INDEX "Professional_userId_idx" ON "Professional"("userId");
CREATE INDEX "Professional_userId_isActive_idx" ON "Professional"("userId", "isActive");
CREATE INDEX "Professional_userId_name_idx" ON "Professional"("userId", "name");
CREATE INDEX "Appointment_userId_professionalId_startsAt_idx" ON "Appointment"("userId", "professionalId", "startsAt");

ALTER TABLE "Professional" ADD CONSTRAINT "Professional_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
