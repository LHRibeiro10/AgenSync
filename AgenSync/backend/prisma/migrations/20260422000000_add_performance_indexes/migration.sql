-- CreateIndex
CREATE INDEX "Client_userId_createdAt_idx" ON "Client"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_userId_createdAt_idx" ON "Expense"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Product_userId_isActive_name_idx" ON "Product"("userId", "isActive", "name");

-- CreateIndex
CREATE INDEX "Product_userId_createdAt_idx" ON "Product"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductSale_userId_createdAt_idx" ON "ProductSale"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MonthlyPlan_userId_status_createdAt_idx" ON "MonthlyPlan"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MonthlyPlan_userId_createdAt_idx" ON "MonthlyPlan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Service_userId_isActive_name_idx" ON "Service"("userId", "isActive", "name");

-- CreateIndex
CREATE INDEX "Service_userId_createdAt_idx" ON "Service"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Professional_userId_isActive_name_idx" ON "Professional"("userId", "isActive", "name");

-- CreateIndex
CREATE INDEX "Professional_userId_createdAt_idx" ON "Professional"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Appointment_userId_createdAt_idx" ON "Appointment"("userId", "createdAt");
