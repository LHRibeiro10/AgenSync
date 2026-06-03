import { Router } from "express";
import { requireAdmin, requireAuth, requirePlatformRole } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { processDueAppointmentReminders } from "../services/appointmentReminderService.js";
import { requireActiveWorkspaceSubscription } from "../services/workspaceBillingAccess.js";
import { requireWorkspaceAccess } from "../utils/accessControl.js";
import { recordAuditEvent } from "../utils/audit.js";
import { normalizeEnvValue } from "../utils/env.js";
import adminRouter from "./admin.js";
import appointmentsRouter from "./appointments.js";
import appointmentRemindersRouter from "./appointmentReminders.js";
import authRouter from "./auth.js";
import billingRouter, { billingWebhookRouter } from "./billing.js";
import clientsRouter from "./clients.js";
import dashboardRouter from "./dashboard.js";
import expensesRouter from "./expenses.js";
import financeRouter from "./finance.js";
import monthlyPlansRouter from "./monthlyPlans.js";
import notificationTokensRouter from "./notificationTokens.js";
import notificationsRouter from "./notifications.js";
import onboardingRouter from "./onboarding.js";
import professionalsRouter from "./professionals.js";
import platformRouter from "./platform.js";
import productsRouter from "./products.js";
import salesRouter from "./sales.js";
import servicesRouter from "./services.js";
import workspaceRouter from "./workspace.js";

const router = Router();

function cronSecretFromRequest(req) {
  const authHeader = String(req.get("authorization") || "");
  if (authHeader.startsWith("Bearer ")) return authHeader.slice("Bearer ".length).trim();
  return String(req.get("x-cron-secret") || req.query.secret || "").trim();
}

function requireCronSecret(req) {
  const configuredSecret = normalizeEnvValue(process.env.CRON_SECRET || process.env.APPOINTMENT_REMINDER_CRON_SECRET);
  if (!configuredSecret && process.env.NODE_ENV !== "production") return;
  if (!configuredSecret) throw new ApiError(500, "CRON_SECRET nao configurado no backend.");
  if (cronSecretFromRequest(req) !== configuredSecret) throw new ApiError(401, "Cron nao autorizado.");
}

function workspaceRoute(req, res, next) {
  requireWorkspaceAccess(req);
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    res.on("finish", () => {
      void recordAuditEvent({
        req,
        userId: req.user.id,
        email: req.user.email,
        eventType: "workspace.action",
        message: "Acao executada no workspace.",
        metadata: {
          workspaceId: req.workspaceId,
          method: req.method,
          route: req.originalUrl,
          statusCode: res.statusCode
        }
      });
    });
  }
  next();
}

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.post(
  "/cron/appointment-reminders/process-due",
  asyncHandler(async (req, res) => {
    requireCronSecret(req);
    const result = await processDueAppointmentReminders({
      limit: req.body?.limit || req.query?.limit || 100
    });
    res.json(result);
  })
);

router.use("/auth", authRouter);
router.use("/billing/webhooks", billingWebhookRouter);
router.use("/workspace", workspaceRouter);
router.use("/admin", requireAuth, requireAdmin, adminRouter);
router.use("/platform", requireAuth, requirePlatformRole(["DEVELOPER", "PLATFORM_OWNER"]), platformRouter);
router.use("/clients", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, clientsRouter);
router.use("/professionals", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, professionalsRouter);
router.use("/services", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, servicesRouter);
router.use("/appointments", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, appointmentsRouter);
router.use("/appointment-reminders", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, appointmentRemindersRouter);
router.use("/dashboard", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, dashboardRouter);
router.use("/finance", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, financeRouter);
router.use("/expenses", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, expensesRouter);
router.use("/products", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, productsRouter);
router.use("/sales", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, salesRouter);
router.use("/subscriptions/monthly-plans", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, monthlyPlansRouter);
router.use("/billing", requireAuth, workspaceRoute, billingRouter);
router.use("/notification-tokens", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, notificationTokensRouter);
router.use("/notifications", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, notificationsRouter);
router.use("/onboarding", requireAuth, workspaceRoute, requireActiveWorkspaceSubscription, onboardingRouter);

export default router;
