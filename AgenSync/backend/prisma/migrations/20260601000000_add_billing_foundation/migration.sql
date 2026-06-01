CREATE TYPE "BillingProvider" AS ENUM ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'ASAAS');
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE', 'CANCELED');
CREATE TYPE "BillingWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');

CREATE TABLE "BillingCustomer" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL DEFAULT 'MANUAL',
  "providerCustomerId" TEXT,
  "email" TEXT,
  "name" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingSubscription" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "billingCustomerId" TEXT,
  "provider" "BillingProvider" NOT NULL DEFAULT 'MANUAL',
  "providerSubscriptionId" TEXT,
  "providerPriceId" TEXT,
  "plan" TEXT NOT NULL,
  "status" "AccountSubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "canceledAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingInvoice" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "billingSubscriptionId" TEXT,
  "provider" "BillingProvider" NOT NULL DEFAULT 'MANUAL',
  "providerInvoiceId" TEXT,
  "providerPaymentId" TEXT,
  "providerCheckoutSessionId" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "hostedUrl" TEXT,
  "pdfUrl" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingWebhookEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "provider" "BillingProvider" NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "BillingWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB NOT NULL,
  "errorMessage" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingCustomer_workspaceId_key" ON "BillingCustomer"("workspaceId");
CREATE UNIQUE INDEX "BillingCustomer_provider_providerCustomerId_key" ON "BillingCustomer"("provider", "providerCustomerId");
CREATE INDEX "BillingCustomer_provider_idx" ON "BillingCustomer"("provider");
CREATE INDEX "BillingCustomer_email_idx" ON "BillingCustomer"("email");

CREATE UNIQUE INDEX "BillingSubscription_provider_providerSubscriptionId_key" ON "BillingSubscription"("provider", "providerSubscriptionId");
CREATE INDEX "BillingSubscription_workspaceId_status_idx" ON "BillingSubscription"("workspaceId", "status");
CREATE INDEX "BillingSubscription_workspaceId_plan_idx" ON "BillingSubscription"("workspaceId", "plan");
CREATE INDEX "BillingSubscription_provider_status_idx" ON "BillingSubscription"("provider", "status");
CREATE INDEX "BillingSubscription_providerPriceId_idx" ON "BillingSubscription"("providerPriceId");
CREATE INDEX "BillingSubscription_currentPeriodEnd_idx" ON "BillingSubscription"("currentPeriodEnd");

CREATE UNIQUE INDEX "BillingInvoice_provider_providerInvoiceId_key" ON "BillingInvoice"("provider", "providerInvoiceId");
CREATE INDEX "BillingInvoice_workspaceId_status_idx" ON "BillingInvoice"("workspaceId", "status");
CREATE INDEX "BillingInvoice_workspaceId_dueAt_idx" ON "BillingInvoice"("workspaceId", "dueAt");
CREATE INDEX "BillingInvoice_provider_status_idx" ON "BillingInvoice"("provider", "status");
CREATE INDEX "BillingInvoice_providerCheckoutSessionId_idx" ON "BillingInvoice"("providerCheckoutSessionId");

CREATE UNIQUE INDEX "BillingWebhookEvent_provider_eventId_key" ON "BillingWebhookEvent"("provider", "eventId");
CREATE INDEX "BillingWebhookEvent_workspaceId_receivedAt_idx" ON "BillingWebhookEvent"("workspaceId", "receivedAt");
CREATE INDEX "BillingWebhookEvent_provider_eventType_idx" ON "BillingWebhookEvent"("provider", "eventType");
CREATE INDEX "BillingWebhookEvent_status_receivedAt_idx" ON "BillingWebhookEvent"("status", "receivedAt");

ALTER TABLE "BillingCustomer"
ADD CONSTRAINT "BillingCustomer_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingSubscription"
ADD CONSTRAINT "BillingSubscription_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingSubscription"
ADD CONSTRAINT "BillingSubscription_billingCustomerId_fkey"
FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingInvoice"
ADD CONSTRAINT "BillingInvoice_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingInvoice"
ADD CONSTRAINT "BillingInvoice_billingSubscriptionId_fkey"
FOREIGN KEY ("billingSubscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingWebhookEvent"
ADD CONSTRAINT "BillingWebhookEvent_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
