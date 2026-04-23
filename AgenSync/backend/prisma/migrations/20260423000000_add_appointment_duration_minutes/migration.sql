ALTER TABLE "Appointment" ADD COLUMN "durationMinutes" INTEGER;

UPDATE "Appointment"
SET "durationMinutes" = GREATEST(1, ROUND(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 60)::INTEGER)
WHERE "durationMinutes" IS NULL;
