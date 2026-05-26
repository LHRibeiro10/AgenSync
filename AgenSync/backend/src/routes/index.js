import { Router } from "express";
import { requireAdmin, requireAuth, requirePlatformRole } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { processDueAppointmentReminders } from "../services/appointmentReminderService.js";
import { requireWorkspaceAccess } from "../utils/accessControl.js";
import { normalizeEnvValue } from "../utils/env.js";
import adminRouter from "./admin.js";
import appointmentsRouter from "./appointments.js";
import appointmentRemindersRouter from "./appointmentReminders.js";
import authRouter from "./auth.js";
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
router.use("/admin", requireAuth, requireAdmin, adminRouter);
router.use("/platform", requireAuth, requirePlatformRole(["DEVELOPER", "PLATFORM_OWNER"]), platformRouter);
router.use("/clients", requireAuth, workspaceRoute, clientsRouter);
router.use("/professionals", requireAuth, workspaceRoute, professionalsRouter);
router.use("/services", requireAuth, workspaceRoute, servicesRouter);
router.use("/appointments", requireAuth, workspaceRoute, appointmentsRouter);
router.use("/appointment-reminders", requireAuth, workspaceRoute, appointmentRemindersRouter);
router.use("/dashboard", requireAuth, workspaceRoute, dashboardRouter);
router.use("/finance", requireAuth, workspaceRoute, financeRouter);
router.use("/expenses", requireAuth, workspaceRoute, expensesRouter);
router.use("/products", requireAuth, workspaceRoute, productsRouter);
router.use("/sales", requireAuth, workspaceRoute, salesRouter);
router.use("/subscriptions/monthly-plans", requireAuth, workspaceRoute, monthlyPlansRouter);
router.use("/notification-tokens", requireAuth, workspaceRoute, notificationTokensRouter);
router.use("/notifications", requireAuth, workspaceRoute, notificationsRouter);
router.use("/onboarding", requireAuth, workspaceRoute, onboardingRouter);

export default router;
