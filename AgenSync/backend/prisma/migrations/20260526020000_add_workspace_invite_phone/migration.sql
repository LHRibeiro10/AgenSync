-- AlterTable
ALTER TABLE "WorkspaceInvite" ADD COLUMN "phone" TEXT;

-- CreateIndex
CREATE INDEX "WorkspaceInvite_workspaceId_phone_idx" ON "WorkspaceInvite"("workspaceId", "phone");
