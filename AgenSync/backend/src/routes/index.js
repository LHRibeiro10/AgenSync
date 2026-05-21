import { Router } from "express";
import { requireAdmin, requireAuth, requirePlatformRole } from "../middleware/auth.js";
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

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRouter);
router.use("/admin", requireAuth, requireAdmin, adminRouter);
router.use("/platform", requireAuth, requirePlatformRole(["DEVELOPER", "PLATFORM_OWNER"]), platformRouter);
router.use("/clients", requireAuth, clientsRouter);
router.use("/professionals", requireAuth, professionalsRouter);
router.use("/services", requireAuth, servicesRouter);
router.use("/appointments", requireAuth, appointmentsRouter);
router.use("/appointment-reminders", requireAuth, appointmentRemindersRouter);
router.use("/dashboard", requireAuth, dashboardRouter);
router.use("/finance", requireAuth, financeRouter);
router.use("/expenses", requireAuth, expensesRouter);
router.use("/products", requireAuth, productsRouter);
router.use("/sales", requireAuth, salesRouter);
router.use("/subscriptions/monthly-plans", requireAuth, monthlyPlansRouter);
router.use("/notification-tokens", requireAuth, notificationTokensRouter);
router.use("/notifications", requireAuth, notificationsRouter);
router.use("/onboarding", requireAuth, onboardingRouter);

export default router;
