WITH previous_migration AS (
  SELECT
    "started_at" - INTERVAL '5 minutes' AS window_start,
    COALESCE("finished_at", "started_at") + INTERVAL '5 minutes' AS window_end
  FROM "_prisma_migrations"
  WHERE "migration_name" = '20260612000000_initialize_existing_workspace_trial_dates'
  ORDER BY "started_at" DESC
  LIMIT 1
),
affected_workspaces AS (
  SELECT
    workspace."id",
    workspace."ownerId",
    workspace."trialEndsAt"
  FROM "Workspace" AS workspace
  JOIN "User" AS owner ON owner."id" = workspace."ownerId"
  JOIN previous_migration ON true
  WHERE COALESCE(owner."platformRole"::TEXT, 'USER') NOT IN ('DEVELOPER', 'PLATFORM_OWNER')
    AND workspace."planStatus" = 'TRIALING'
    AND workspace."trialStartedAt" BETWEEN previous_migration.window_start AND previous_migration.window_end
    AND workspace."trialEndsAt" = workspace."trialStartedAt" + INTERVAL '15 days'
    AND NOT EXISTS (
      SELECT 1
      FROM "BillingSubscription" AS subscription
      WHERE subscription."workspaceId" = workspace."id"
        AND subscription."status" IN ('ACTIVE', 'PAST_DUE', 'BLOCKED', 'CANCELED', 'MANUAL_UNLOCKED')
    )
)
UPDATE "User" AS owner
SET
  "subscriptionStatus" = 'PAID',
  "subscriptionPaidUntil" = NULL,
  "billingEnabled" = false,
  "updatedAt" = CURRENT_TIMESTAMP
FROM affected_workspaces
WHERE owner."id" = affected_workspaces."ownerId"
  AND owner."subscriptionStatus" = 'TRIALING'
  AND owner."subscriptionPaidUntil" = affected_workspaces."trialEndsAt";

WITH previous_migration AS (
  SELECT
    "started_at" - INTERVAL '5 minutes' AS window_start,
    COALESCE("finished_at", "started_at") + INTERVAL '5 minutes' AS window_end
  FROM "_prisma_migrations"
  WHERE "migration_name" = '20260612000000_initialize_existing_workspace_trial_dates'
  ORDER BY "started_at" DESC
  LIMIT 1
)
UPDATE "Workspace" AS workspace
SET
  "planStatus" = 'PAID',
  "trialStartedAt" = NULL,
  "trialEndsAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "User" AS owner, previous_migration
WHERE workspace."ownerId" = owner."id"
  AND COALESCE(owner."platformRole"::TEXT, 'USER') NOT IN ('DEVELOPER', 'PLATFORM_OWNER')
  AND workspace."planStatus" = 'TRIALING'
  AND workspace."trialStartedAt" BETWEEN previous_migration.window_start AND previous_migration.window_end
  AND workspace."trialEndsAt" = workspace."trialStartedAt" + INTERVAL '15 days'
  AND NOT EXISTS (
    SELECT 1
    FROM "BillingSubscription" AS subscription
    WHERE subscription."workspaceId" = workspace."id"
      AND subscription."status" IN ('ACTIVE', 'PAST_DUE', 'BLOCKED', 'CANCELED', 'MANUAL_UNLOCKED')
  );
