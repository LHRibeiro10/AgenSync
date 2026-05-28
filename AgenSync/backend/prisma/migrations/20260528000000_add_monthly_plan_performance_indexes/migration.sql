CREATE INDEX IF NOT EXISTS "idx_monthly_plan_workspace_status_start"
ON "MonthlyPlan" ("workspaceId", "status", "startDate");

CREATE INDEX IF NOT EXISTS "idx_monthly_plan_workspace_prof_status_start"
ON "MonthlyPlan" ("workspaceId", "professionalId", "status", "startDate");

CREATE INDEX IF NOT EXISTS "idx_monthly_plan_workspace_billing_status"
ON "MonthlyPlan" ("workspaceId", "billingType", "status");

CREATE INDEX IF NOT EXISTS "idx_monthly_plan_workspace_created"
ON "MonthlyPlan" ("workspaceId", "createdAt");

CREATE INDEX IF NOT EXISTS "idx_monthly_payment_plan_month_status"
ON "MonthlyPlanPayment" ("monthlyPlanId", "month", "status");

CREATE INDEX IF NOT EXISTS "idx_monthly_payment_month_status_due"
ON "MonthlyPlanPayment" ("month", "status", "dueDate");
