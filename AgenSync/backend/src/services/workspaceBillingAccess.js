import { ApiError } from "../middleware/error.js";
import { prisma } from "../prisma.js";
import { normalizePlanSlug } from "../config/plans.js";

export const BILLING_ACCESS_STATUSES = Object.freeze({
  TRIALING: "TRIALING",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  BLOCKED: "BLOCKED",
  CANCELED: "CANCELED",
  MANUAL_UNLOCKED: "MANUAL_UNLOCKED"
});

const LEGACY_UNINITIALIZED_STATUSES = new Set(["", "PAID", "TRIAL"]);
const ACCESS_ALLOWED_STATUSES = new Set(["ACTIVE", "PAID", "MANUAL_UNLOCKED"]);
const ACCESS_BLOCKED_STATUSES = new Set(["PAST_DUE", "BLOCKED", "CANCELED"]);
const TRIAL_DAYS = 15;

function isPlatformOwner(user) {
  const role = String(user?.platformRole || "").trim().toUpperCase();
  return role === "DEVELOPER" || role === "PLATFORM_OWNER";
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function normalizeStatus(value, fallback = BILLING_ACCESS_STATUSES.TRIALING) {
  const status = String(value || "").trim().toUpperCase();
  if (status === "TRIAL") return BILLING_ACCESS_STATUSES.TRIALING;
  if (status === "PAID") return BILLING_ACCESS_STATUSES.ACTIVE;
  return status || fallback;
}

function publicStatus(value) {
  return normalizeStatus(value).toLowerCase();
}

function statusReason(status, workspace) {
  if (status === BILLING_ACCESS_STATUSES.TRIALING && isTrialExpired(workspace)) return "trial_expired";
  if (status === BILLING_ACCESS_STATUSES.PAST_DUE) return "payment_overdue";
  if (status === BILLING_ACCESS_STATUSES.CANCELED) return "canceled";
  return "blocked";
}

function blockMessage(reason) {
  if (reason === "trial_expired") return "Seu periodo de teste gratis terminou.";
  if (reason === "payment_overdue") return "Sua assinatura esta vencida.";
  if (reason === "canceled") return "Sua assinatura esta cancelada.";
  return "Seu acesso esta bloqueado.";
}

export function isTrialExpired(workspace, now = new Date()) {
  const status = normalizeStatus(workspace?.planStatus);
  if (status !== BILLING_ACCESS_STATUSES.TRIALING) return false;
  if (!workspace?.trialEndsAt) return false;
  return new Date(workspace.trialEndsAt).getTime() < now.getTime();
}

export function isSubscriptionActive(workspace, now = new Date()) {
  const status = normalizeStatus(workspace?.planStatus);
  if (ACCESS_ALLOWED_STATUSES.has(status)) return true;
  if (status === BILLING_ACCESS_STATUSES.TRIALING) return !isTrialExpired(workspace, now);
  return false;
}

export function getWorkspaceAccessStatus(workspace, { platformUser = false, now = new Date() } = {}) {
  if (platformUser) {
    return {
      allowed: true,
      reason: "",
      planStatus: "manual_unlocked",
      message: "",
      checkoutAvailable: false,
      trialDaysRemaining: null
    };
  }

  const status = normalizeStatus(workspace?.planStatus);
  const trialEndsAt = workspace?.trialEndsAt ? new Date(workspace.trialEndsAt) : null;
  const trialDaysRemaining =
    status === BILLING_ACCESS_STATUSES.TRIALING && trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000))
      : null;

  const trialAllowed = status === BILLING_ACCESS_STATUSES.TRIALING && !isTrialExpired(workspace, now);
  const allowed = ACCESS_ALLOWED_STATUSES.has(status) || trialAllowed;
  const reason = allowed ? "" : statusReason(status, workspace);

  return {
    allowed,
    reason,
    planStatus: publicStatus(status),
    message: allowed ? "" : blockMessage(reason),
    checkoutAvailable: true,
    trialDaysRemaining
  };
}

export async function ensureWorkspaceTrialInitialized(workspaceOrId, { client = prisma, force = false } = {}) {
  const workspaceId = typeof workspaceOrId === "string" ? workspaceOrId : workspaceOrId?.id;
  if (!workspaceId) return null;

  const workspace =
    typeof workspaceOrId === "object" && workspaceOrId?.owner
      ? workspaceOrId
      : await client.workspace.findUnique({
          where: { id: workspaceId },
          include: {
            owner: {
              select: {
                id: true,
                platformRole: true,
                subscriptionStatus: true,
                subscriptionPaidUntil: true,
                billingEnabled: true
              }
            },
            billingSubscriptions: {
              select: { id: true, status: true },
              take: 1
            }
          }
        });

  if (!workspace) return null;
  if (isPlatformOwner(workspace.owner)) return workspace;

  const currentStatus = String(workspace.planStatus || "").trim().toUpperCase();
  const hasBilling = Array.isArray(workspace.billingSubscriptions) && workspace.billingSubscriptions.length > 0;
  const hasTrial = Boolean(workspace.trialStartedAt || workspace.trialEndsAt);
  const hasExplicitStatus =
    !LEGACY_UNINITIALIZED_STATUSES.has(currentStatus) && currentStatus !== BILLING_ACCESS_STATUSES.TRIALING;

  if (!force && (hasTrial || hasBilling || hasExplicitStatus)) {
    return workspace;
  }

  const now = new Date();
  const trialEndsAt = addDays(now, TRIAL_DAYS);
  const plan = normalizePlanSlug(workspace.plan);

  const updated = await client.$transaction(async (tx) => {
    await tx.billingSubscription.create({
      data: {
        workspaceId: workspace.id,
        provider: "MANUAL",
        plan,
        status: BILLING_ACCESS_STATUSES.TRIALING,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        metadata: { source: "trial_init" }
      }
    });

    const nextWorkspace = await tx.workspace.update({
      where: { id: workspace.id },
      data: {
        plan,
        planStatus: BILLING_ACCESS_STATUSES.TRIALING,
        trialStartedAt: now,
        trialEndsAt
      },
      include: {
        owner: {
          select: {
            id: true,
            platformRole: true,
            subscriptionStatus: true,
            subscriptionPaidUntil: true,
            billingEnabled: true
          }
        },
        billingSubscriptions: {
          select: { id: true, status: true },
          take: 1
        }
      }
    });

    await tx.user.update({
      where: { id: workspace.ownerId },
      data: {
        platformPlan: plan,
        subscriptionStatus: BILLING_ACCESS_STATUSES.TRIALING,
        subscriptionPaidUntil: trialEndsAt,
        billingEnabled: true
      }
    });

    return nextWorkspace;
  });
  return updated;
}

export async function requireActiveWorkspaceSubscription(req, res, next) {
  if (isPlatformOwner(req.user)) {
    next();
    return;
  }

  const workspace = await ensureWorkspaceTrialInitialized(req.workspace || req.workspaceId);
  const access = getWorkspaceAccessStatus(workspace || req.workspace);
  req.workspaceAccessStatus = access;

  if (access.allowed) {
    next();
    return;
  }

  throw new ApiError(402, access.message || "Assinatura obrigatoria para continuar.", {
    code: "SUBSCRIPTION_REQUIRED",
    reason: access.reason,
    message: access.message,
    planStatus: access.planStatus,
    checkoutAvailable: access.checkoutAvailable
  });
}
