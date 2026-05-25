-- CreateEnum
CREATE TYPE "WorkspaceMemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "ownerId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'padrao',
    "planStatus" "AccountSubscriptionStatus" NOT NULL DEFAULT 'PAID',
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'PROFESSIONAL',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "professionalId" TEXT,
    "status" "WorkspaceMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "currentWorkspaceId" TEXT;
ALTER TABLE "Client" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Product" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ProductSale" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "MonthlyPlan" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ClientCareRecord" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Service" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Professional" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "workspaceId" TEXT;

-- Bootstrap one workspace per existing non-platform account.
INSERT INTO "Workspace" ("id", "name", "ownerId", "plan", "planStatus", "createdAt", "updatedAt")
SELECT
    'workspace_' || "User"."id",
    COALESCE(NULLIF("User"."businessName", ''), NULLIF("User"."name", ''), 'Meu negocio'),
    "User"."id",
    CASE LOWER(COALESCE("User"."platformPlan", ''))
        WHEN 'equipe' THEN 'equipe'
        WHEN 'pro' THEN 'pro'
        ELSE 'padrao'
    END,
    COALESCE("User"."subscriptionStatus", 'PAID'::"AccountSubscriptionStatus"),
    COALESCE("User"."createdAt", CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM "User"
WHERE COALESCE("User"."platformRole"::TEXT, 'USER') NOT IN ('DEVELOPER', 'PLATFORM_OWNER')
ON CONFLICT ("id") DO NOTHING;

UPDATE "User"
SET "currentWorkspaceId" = "Workspace"."id"
FROM "Workspace"
WHERE "Workspace"."ownerId" = "User"."id"
  AND "User"."currentWorkspaceId" IS NULL;

UPDATE "Professional"
SET "workspaceId" = "User"."currentWorkspaceId"
FROM "User"
WHERE "Professional"."userId" = "User"."id"
  AND "Professional"."workspaceId" IS NULL
  AND "User"."currentWorkspaceId" IS NOT NULL;

UPDATE "Client"
SET "workspaceId" = "User"."currentWorkspaceId"
FROM "User"
WHERE "Client"."userId" = "User"."id"
  AND "Client"."workspaceId" IS NULL
  AND "User"."currentWorkspaceId" IS NOT NULL;

UPDATE "Service"
SET "workspaceId" = "User"."currentWorkspaceId"
FROM "User"
WHERE "Service"."userId" = "User"."id"
  AND "Service"."workspaceId" IS NULL
  AND "User"."currentWorkspaceId" IS NOT NULL;

UPDATE "Appointment"
SET "workspaceId" = "User"."currentWorkspaceId"
FROM "User"
WHERE "Appointment"."userId" = "User"."id"
  AND "Appointment"."workspaceId" IS NULL
  AND "User"."currentWorkspaceId" IS NOT NULL;

UPDATE "Expense"
SET "workspaceId" = "User"."currentWorkspaceId"
FROM "User"
WHERE "Expense"."userId" = "User"."id"
  AND "Expense"."workspaceId" IS NULL
  AND "User"."currentWorkspaceId" IS NOT NULL;

UPDATE "Product"
SET "workspaceId" = "User"."currentWorkspaceId"
FROM "User"
WHERE "Product"."userId" = "User"."id"
  AND "Product"."workspaceId" IS NULL
  AND "User"."currentWorkspaceId" IS NOT NULL;

UPDATE "ProductSale"
SET "workspaceId" = "User"."currentWorkspaceId"
FROM "User"
WHERE "ProductSale"."userId" = "User"."id"
  AND "ProductSale"."workspaceId" IS NULL
  AND "User"."currentWorkspaceId" IS NOT NULL;

UPDATE "MonthlyPlan"
SET "workspaceId" = "User"."currentWorkspaceId"
FROM "User"
WHERE "MonthlyPlan"."userId" = "User"."id"
  AND "MonthlyPlan"."workspaceId" IS NULL
  AND "User"."currentWorkspaceId" IS NOT NULL;

UPDATE "ClientCareRecord"
SET "workspaceId" = "Client"."workspaceId"
FROM "Client"
WHERE "ClientCareRecord"."clientId" = "Client"."id"
  AND "ClientCareRecord"."workspaceId" IS NULL
  AND "Client"."workspaceId" IS NOT NULL;

UPDATE "Notification"
SET "workspaceId" = "User"."currentWorkspaceId"
FROM "User"
WHERE "Notification"."userId" = "User"."id"
  AND "Notification"."workspaceId" IS DISTINCT FROM "User"."currentWorkspaceId"
  AND "User"."currentWorkspaceId" IS NOT NULL;

INSERT INTO "WorkspaceMember" (
    "id",
    "workspaceId",
    "userId",
    "role",
    "permissions",
    "professionalId",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    'member_' || "User"."id",
    "User"."currentWorkspaceId",
    "User"."id",
    COALESCE("User"."workspaceRole", 'OWNER'::"WorkspaceRole"),
    '{}'::JSONB,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM "Professional"
        WHERE "Professional"."id" = "User"."professionalId"
          AND "Professional"."workspaceId" = "User"."currentWorkspaceId"
      )
      THEN "User"."professionalId"
      ELSE (
        SELECT "Professional"."id"
        FROM "Professional"
        WHERE "Professional"."workspaceId" = "User"."currentWorkspaceId"
        ORDER BY "Professional"."createdAt" ASC
        LIMIT 1
      )
    END,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User"
WHERE "User"."currentWorkspaceId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "WorkspaceMember"
    WHERE "WorkspaceMember"."workspaceId" = "User"."currentWorkspaceId"
      AND "WorkspaceMember"."userId" = "User"."id"
  );

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");
CREATE INDEX "Workspace_plan_idx" ON "Workspace"("plan");
CREATE INDEX "Workspace_planStatus_idx" ON "Workspace"("planStatus");
CREATE INDEX "Workspace_createdAt_idx" ON "Workspace"("createdAt");

CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");
CREATE INDEX "WorkspaceMember_workspaceId_role_idx" ON "WorkspaceMember"("workspaceId", "role");
CREATE INDEX "WorkspaceMember_workspaceId_status_idx" ON "WorkspaceMember"("workspaceId", "status");
CREATE INDEX "WorkspaceMember_userId_status_idx" ON "WorkspaceMember"("userId", "status");
CREATE INDEX "WorkspaceMember_professionalId_idx" ON "WorkspaceMember"("professionalId");

CREATE INDEX "User_currentWorkspaceId_idx" ON "User"("currentWorkspaceId");

CREATE INDEX "Client_workspaceId_idx" ON "Client"("workspaceId");
CREATE INDEX "Client_workspaceId_name_idx" ON "Client"("workspaceId", "name");
CREATE INDEX "Client_workspaceId_phone_idx" ON "Client"("workspaceId", "phone");
CREATE INDEX "Client_workspaceId_email_idx" ON "Client"("workspaceId", "email");
CREATE INDEX "Client_workspaceId_isActive_idx" ON "Client"("workspaceId", "isActive");

CREATE INDEX "Expense_workspaceId_date_idx" ON "Expense"("workspaceId", "date");
CREATE INDEX "Expense_workspaceId_category_date_idx" ON "Expense"("workspaceId", "category", "date");

CREATE INDEX "Product_workspaceId_idx" ON "Product"("workspaceId");
CREATE INDEX "Product_workspaceId_isActive_idx" ON "Product"("workspaceId", "isActive");
CREATE INDEX "Product_workspaceId_category_idx" ON "Product"("workspaceId", "category");
CREATE INDEX "Product_workspaceId_isActive_name_idx" ON "Product"("workspaceId", "isActive", "name");

CREATE INDEX "ProductSale_workspaceId_date_idx" ON "ProductSale"("workspaceId", "date");
CREATE INDEX "ProductSale_workspaceId_productId_date_idx" ON "ProductSale"("workspaceId", "productId", "date");
CREATE INDEX "ProductSale_workspaceId_clientId_date_idx" ON "ProductSale"("workspaceId", "clientId", "date");

CREATE INDEX "MonthlyPlan_workspaceId_status_idx" ON "MonthlyPlan"("workspaceId", "status");
CREATE INDEX "MonthlyPlan_workspaceId_clientId_idx" ON "MonthlyPlan"("workspaceId", "clientId");
CREATE INDEX "MonthlyPlan_workspaceId_serviceId_idx" ON "MonthlyPlan"("workspaceId", "serviceId");
CREATE INDEX "MonthlyPlan_workspaceId_professionalId_idx" ON "MonthlyPlan"("workspaceId", "professionalId");
CREATE INDEX "MonthlyPlan_workspaceId_billingType_idx" ON "MonthlyPlan"("workspaceId", "billingType");
CREATE INDEX "MonthlyPlan_workspaceId_startDate_idx" ON "MonthlyPlan"("workspaceId", "startDate");

CREATE INDEX "ClientCareRecord_workspaceId_idx" ON "ClientCareRecord"("workspaceId");

CREATE INDEX "Service_workspaceId_idx" ON "Service"("workspaceId");
CREATE INDEX "Service_workspaceId_isActive_idx" ON "Service"("workspaceId", "isActive");
CREATE INDEX "Service_workspaceId_isActive_name_idx" ON "Service"("workspaceId", "isActive", "name");

CREATE INDEX "Professional_workspaceId_idx" ON "Professional"("workspaceId");
CREATE INDEX "Professional_workspaceId_isActive_idx" ON "Professional"("workspaceId", "isActive");
CREATE INDEX "Professional_workspaceId_name_idx" ON "Professional"("workspaceId", "name");
CREATE INDEX "Professional_workspaceId_email_idx" ON "Professional"("workspaceId", "email");
CREATE INDEX "Professional_workspaceId_isActive_name_idx" ON "Professional"("workspaceId", "isActive", "name");

CREATE INDEX "Appointment_workspaceId_startsAt_idx" ON "Appointment"("workspaceId", "startsAt");
CREATE INDEX "Appointment_workspaceId_status_startsAt_idx" ON "Appointment"("workspaceId", "status", "startsAt");
CREATE INDEX "Appointment_workspaceId_clientId_idx" ON "Appointment"("workspaceId", "clientId");
CREATE INDEX "Appointment_workspaceId_professionalId_startsAt_idx" ON "Appointment"("workspaceId", "professionalId", "startsAt");
CREATE INDEX "Appointment_workspaceId_monthlyPlanId_startsAt_idx" ON "Appointment"("workspaceId", "monthlyPlanId", "startsAt");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_currentWorkspaceId_fkey" FOREIGN KEY ("currentWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyPlan" ADD CONSTRAINT "MonthlyPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientCareRecord" ADD CONSTRAINT "ClientCareRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
