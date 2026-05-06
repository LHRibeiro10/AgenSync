ALTER TABLE "User"
ADD COLUMN "whatsappReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsappReminderOffsetMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN "whatsappReminderMessage" TEXT,
ADD COLUMN "whatsappReminderTestPhone" TEXT;
