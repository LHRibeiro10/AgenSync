ALTER TABLE "Client" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Client_userId_isActive_idx" ON "Client"("userId", "isActive");
