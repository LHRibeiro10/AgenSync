import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import appointmentsRouter from "./appointments.js";
import authRouter from "./auth.js";
import clientsRouter from "./clients.js";
import dashboardRouter from "./dashboard.js";
import expensesRouter from "./expenses.js";
import financeRouter from "./finance.js";
import monthlyPlansRouter from "./monthlyPlans.js";
import professionalsRouter from "./professionals.js";
import productsRouter from "./products.js";
import salesRouter from "./sales.js";
import servicesRouter from "./services.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRouter);
router.use("/clients", requireAuth, clientsRouter);
router.use("/professionals", requireAuth, professionalsRouter);
router.use("/services", requireAuth, servicesRouter);
router.use("/appointments", requireAuth, appointmentsRouter);
router.use("/dashboard", requireAuth, dashboardRouter);
router.use("/finance", requireAuth, financeRouter);
router.use("/expenses", requireAuth, expensesRouter);
router.use("/products", requireAuth, productsRouter);
router.use("/sales", requireAuth, salesRouter);
router.use("/subscriptions/monthly-plans", requireAuth, monthlyPlansRouter);

export default router;
