ALTER TYPE "ReminderType" ADD VALUE IF NOT EXISTS 'TEN_MINUTES_BEFORE';
ALTER TYPE "ReminderType" ADD VALUE IF NOT EXISTS 'FIFTEEN_MINUTES_BEFORE';
ALTER TYPE "ReminderType" ADD VALUE IF NOT EXISTS 'ONE_HOUR_BEFORE';

ALTER TABLE "User"
ADD COLUMN "whatsappConfirmationMessage" TEXT,
ADD COLUMN "appointmentNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "appointmentNotificationOffsetMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "appointmentNotificationChannels" JSONB NOT NULL DEFAULT '["internal","push"]';

ALTER TABLE "Notification"
ADD COLUMN "workspaceId" TEXT,
ADD COLUMN "relatedEntityType" TEXT,
ADD COLUMN "relatedEntityId" TEXT;

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX "PushSubscription_userId_updatedAt_idx" ON "PushSubscription"("userId", "updatedAt");
CREATE INDEX "Notification_userId_relatedEntityType_relatedEntityId_idx" ON "Notification"("userId", "relatedEntityType", "relatedEntityId");
CREATE INDEX "Notification_workspaceId_createdAt_idx" ON "Notification"("workspaceId", "createdAt");

ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
