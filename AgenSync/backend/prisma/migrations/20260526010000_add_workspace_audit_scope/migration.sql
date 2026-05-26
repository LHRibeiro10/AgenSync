-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "workspaceId" TEXT;

-- Backfill workspace scope for logs that already stored workspaceId in metadata.
UPDATE "AuditLog"
SET "workspaceId" = "Workspace"."id"
FROM "Workspace"
WHERE "AuditLog"."workspaceId" IS NULL
  AND "AuditLog"."metadata" IS NOT NULL
  AND "AuditLog"."metadata"->>'workspaceId' = "Workspace"."id";

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");
CREATE INDEX "AuditLog_workspaceId_eventType_createdAt_idx" ON "AuditLog"("workspaceId", "eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
