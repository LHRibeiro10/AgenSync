UPDATE "Workspace" AS workspace
SET
  "planStatus" = 'TRIALING',
  "trialStartedAt" = CURRENT_TIMESTAMP,
  "trialEndsAt" = CURRENT_TIMESTAMP + INTERVAL '15 days',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "User" AS owner
WHERE workspace."ownerId" = owner."id"
  AND COALESCE(owner."platformRole"::TEXT, 'USER') NOT IN ('DEVELOPER', 'PLATFORM_OWNER')
  AND workspace."trialStartedAt" IS NULL
  AND workspace."trialEndsAt" IS NULL
  AND workspace."planStatus" IN ('PAID', 'TRIAL', 'TRIALING')
  AND NOT EXISTS (
    SELECT 1
    FROM "BillingSubscription" AS subscription
    WHERE subscription."workspaceId" = workspace."id"
      AND subscription."status" IN ('ACTIVE', 'PAST_DUE', 'BLOCKED', 'CANCELED', 'MANUAL_UNLOCKED')
  );

UPDATE "User" AS owner
SET
  "subscriptionStatus" = 'TRIALING',
  "subscriptionPaidUntil" = workspace."trialEndsAt",
  "billingEnabled" = true,
  "platformPlan" = workspace."plan",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Workspace" AS workspace
WHERE workspace."ownerId" = owner."id"
  AND COALESCE(owner."platformRole"::TEXT, 'USER') NOT IN ('DEVELOPER', 'PLATFORM_OWNER')
  AND workspace."planStatus" = 'TRIALING'
  AND workspace."trialStartedAt" IS NOT NULL
  AND workspace."trialEndsAt" IS NOT NULL
  AND owner."subscriptionStatus" IN ('PAID', 'TRIAL', 'TRIALING');
