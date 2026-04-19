import cors from "cors";
import express from "express";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import appointmentsRouter from "./routes/appointments.js";
import authRouter from "./routes/auth.js";
import clientsRouter from "./routes/clients.js";
import dashboardRouter from "./routes/dashboard.js";
import expensesRouter from "./routes/expenses.js";
import financeRouter from "./routes/finance.js";
import monthlyPlansRouter from "./routes/monthlyPlans.js";
import professionalsRouter from "./routes/professionals.js";
import productsRouter from "./routes/products.js";
import salesRouter from "./routes/sales.js";
import servicesRouter from "./routes/services.js";

export const app = express();

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : true;

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, name: "AgenSync API" });
});

app.use("/api/auth", authRouter);
app.use("/api/clients", requireAuth, clientsRouter);
app.use("/api/professionals", requireAuth, professionalsRouter);
app.use("/api/services", requireAuth, servicesRouter);
app.use("/api/appointments", requireAuth, appointmentsRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);
app.use("/api/finance", requireAuth, financeRouter);
app.use("/api/expenses", requireAuth, expensesRouter);
app.use("/api/products", requireAuth, productsRouter);
app.use("/api/sales", requireAuth, salesRouter);
app.use("/api/subscriptions/monthly-plans", requireAuth, monthlyPlansRouter);

app.use(notFound);
app.use(errorHandler);
