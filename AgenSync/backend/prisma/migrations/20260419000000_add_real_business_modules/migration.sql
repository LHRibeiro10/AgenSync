CREATE TYPE "ExpenseRecurrence" AS ENUM ('ONCE', 'MONTHLY');
CREATE TYPE "MonthlyPlanStatus" AS ENUM ('ACTIVE', 'CANCELED');
CREATE TYPE "MonthlyPaymentStatus" AS ENUM ('PENDING', 'PAID');

CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recurrence" "ExpenseRecurrence" NOT NULL DEFAULT 'ONCE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "salePrice" DECIMAL(10,2) NOT NULL,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductSale" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "clientId" TEXT,
    "productName" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" "MonthlyPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "canceledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyPlanPayment" (
    "id" TEXT NOT NULL,
    "monthlyPlanId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" "MonthlyPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "amount" DECIMAL(10,2) NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyPlanPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientCareRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "anamnesis" JSONB,
    "documents" JSONB NOT NULL DEFAULT '[]',
    "budgets" JSONB NOT NULL DEFAULT '[]',
    "forms" JSONB NOT NULL DEFAULT '[]',
    "photos" JSONB NOT NULL DEFAULT '[]',
    "evolutions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCareRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlyPlanPayment_monthlyPlanId_month_key" ON "MonthlyPlanPayment"("monthlyPlanId", "month");
CREATE UNIQUE INDEX "ClientCareRecord_clientId_key" ON "ClientCareRecord"("clientId");

CREATE INDEX "Expense_userId_date_idx" ON "Expense"("userId", "date");
CREATE INDEX "Expense_userId_category_date_idx" ON "Expense"("userId", "category", "date");
CREATE INDEX "Product_userId_idx" ON "Product"("userId");
CREATE INDEX "Product_userId_isActive_idx" ON "Product"("userId", "isActive");
CREATE INDEX "Product_userId_category_idx" ON "Product"("userId", "category");
CREATE INDEX "ProductSale_userId_date_idx" ON "ProductSale"("userId", "date");
CREATE INDEX "ProductSale_userId_productId_date_idx" ON "ProductSale"("userId", "productId", "date");
CREATE INDEX "ProductSale_userId_clientId_date_idx" ON "ProductSale"("userId", "clientId", "date");
CREATE INDEX "MonthlyPlan_userId_status_idx" ON "MonthlyPlan"("userId", "status");
CREATE INDEX "MonthlyPlan_userId_clientId_idx" ON "MonthlyPlan"("userId", "clientId");
CREATE INDEX "MonthlyPlan_userId_startDate_idx" ON "MonthlyPlan"("userId", "startDate");
CREATE INDEX "MonthlyPlanPayment_month_status_idx" ON "MonthlyPlanPayment"("month", "status");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonthlyPlan" ADD CONSTRAINT "MonthlyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyPlan" ADD CONSTRAINT "MonthlyPlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MonthlyPlanPayment" ADD CONSTRAINT "MonthlyPlanPayment_monthlyPlanId_fkey" FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientCareRecord" ADD CONSTRAINT "ClientCareRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
