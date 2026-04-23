import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { formatDate, parseDateOnly, todayString } from "../utils/dates.js";
import { publicMonthlyPlan } from "../utils/formatters.js";
import { optionalString, parsePagination, parsePositiveInteger, parsePositiveMoney, requiredString } from "../utils/validation.js";

const router = Router();

const monthlyPlanSelect = {
  id: true,
  userId: true,
  clientId: true,
  planName: true,
  amount: true,
  dueDay: true,
  startDate: true,
  status: true,
  canceledAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      name: true
    }
  },
  payments: {
    select: {
      month: true,
      status: true,
      paidAt: true,
      amount: true,
      manual: true
    }
  }
};

const pad = (value) => String(value).padStart(2, "0");

function monthKey(value = todayString()) {
  return String(value).slice(0, 7);
}

function monthEndDate(month) {
  const [year, number] = month.split("-").map(Number);
  return new Date(year, number, 0).getDate();
}

function dueDateForMonth(month, dueDay) {
  return `${month}-${pad(Math.max(1, Math.min(Number(dueDay || 1), monthEndDate(month))))}`;
}

function startOfMonth(value) {
  const [year, number] = monthKey(value).split("-").map(Number);
  return new Date(year, number - 1, 1);
}

function nextMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function shouldIncludePlan(plan, month) {
  if (month < monthKey(formatDate(plan.startDate))) return false;
  if (plan.status === "CANCELED" && plan.canceledAt && month > monthKey(formatDate(plan.canceledAt))) return false;
  return true;
}

function cycleForMonth(plan, month) {
  const publicPlan = publicMonthlyPlan(plan);
  const payment = publicPlan.payments.find((item) => item.month === month);
  const dueDate = dueDateForMonth(month, publicPlan.dueDay);
  const status = payment?.status === "paid" ? "paid" : dueDate < todayString() ? "overdue" : "pending";

  return {
    id: `${publicPlan.id}_${month}`,
    subscriptionId: publicPlan.id,
    clientId: publicPlan.clientId,
    clientName: publicPlan.clientName,
    planName: publicPlan.planName,
    amount: payment?.amount || publicPlan.amount,
    dueDay: publicPlan.dueDay,
    dueDate,
    month,
    status,
    paidAt: payment?.paidAt || "",
    subscriptionStatus: publicPlan.status,
    notes: publicPlan.notes
  };
}

function cyclesForRange(plans, startDate, endDate) {
  const cycles = [];
  plans.forEach((plan) => {
    let cursor = startOfMonth(startDate);
    const end = startOfMonth(endDate);
    while (cursor <= end) {
      const month = formatDate(cursor).slice(0, 7);
      if (shouldIncludePlan(plan, month)) {
        const cycle = cycleForMonth(plan, month);
        const paidInRange = cycle.status === "paid" && cycle.paidAt >= startDate && cycle.paidAt <= endDate;
        const dueInRange = cycle.dueDate >= startDate && cycle.dueDate <= endDate;
        if (paidInRange || dueInRange) cycles.push(cycle);
      }
      cursor = nextMonth(cursor);
    }
  });

  return cycles.sort((first, second) => `${second.dueDate}${second.clientName}`.localeCompare(`${first.dueDate}${first.clientName}`));
}

async function findPlan(userId, id) {
  const plan = await prisma.monthlyPlan.findFirst({
    where: { id, userId },
    select: monthlyPlanSelect
  });
  if (!plan) throw new ApiError(404, "Mensalidade não encontrada.");
  return plan;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const month = monthKey(req.query.month || req.query.endDate || todayString());
    const includeCycles = req.query.includeCycles === "true";
    const includeSummary = req.query.includeSummary === "true";
    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });

    const plans = await prisma.monthlyPlan.findMany({
      where: {
        userId: req.user.id,
        ...(req.query.status ? { status: req.query.status === "canceled" ? "CANCELED" : "ACTIVE" } : {})
      },
      ...(!includeCycles && !includeSummary && pagination.enabled
        ? { skip: pagination.skip, take: pagination.take }
        : {}),
      select: monthlyPlanSelect,
      orderBy: [{ createdAt: "desc" }]
    });

    if (includeCycles) {
      const startDate = req.query.startDate || `${month}-01`;
      const endDate = req.query.endDate || `${month}-${pad(monthEndDate(month))}`;
      return res.json({ cycles: cyclesForRange(plans, startDate, endDate) });
    }

    if (includeSummary) {
      const startDate = `${month}-01`;
      const endDate = `${month}-${pad(monthEndDate(month))}`;
      const cycles = cyclesForRange(plans, startDate, endDate);
      return res.json({
        summary: {
          activeCount: plans.filter((plan) => plan.status === "ACTIVE").length,
          pending: cycles.filter((cycle) => cycle.status === "pending").length,
          overdue: cycles.filter((cycle) => cycle.status === "overdue").length,
          paid: cycles.filter((cycle) => cycle.status === "paid").length,
          expected: cycles.reduce((total, cycle) => total + Number(cycle.amount || 0), 0),
          received: cycles.filter((cycle) => cycle.status === "paid").reduce((total, cycle) => total + Number(cycle.amount || 0), 0),
          cycles
        }
      });
    }

    const publicPlans = plans.map((plan) => ({
      ...publicMonthlyPlan(plan),
      currentCycle: shouldIncludePlan(plan, month) ? cycleForMonth(plan, month) : null
    }));

    res.json({ monthlyPlans: publicPlans });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const clientId = requiredString(req.body.clientId, "cliente");
    const client = await prisma.client.findFirst({ where: { id: clientId, userId: req.user.id }, select: { id: true } });
    if (!client) throw new ApiError(400, "Cliente inválido para esta mensalidade.");

    const amount = parsePositiveMoney(req.body.amount, "valor mensal");
    const startDate = parseDateOnly(requiredString(req.body.startDate, "data de início"));
    const plan = await prisma.monthlyPlan.create({
      data: {
        userId: req.user.id,
        clientId,
        planName: requiredString(req.body.planName, "nome do plano", 2),
        amount,
        dueDay: Math.min(parsePositiveInteger(req.body.dueDay, "dia de vencimento"), 31),
        startDate,
        status: req.body.status === "canceled" ? "CANCELED" : "ACTIVE",
        notes: optionalString(req.body.notes),
        payments: {
          create: {
            month: monthKey(formatDate(startDate)),
            status: "PENDING",
            amount
          }
        }
      },
      select: monthlyPlanSelect
    });

    res.status(201).json({ monthlyPlan: publicMonthlyPlan(plan) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    await findPlan(req.user.id, req.params.id);
    const amount = parsePositiveMoney(req.body.amount, "valor mensal");

    const plan = await prisma.monthlyPlan.update({
      where: { id: req.params.id },
      data: {
        clientId: requiredString(req.body.clientId, "cliente"),
        planName: requiredString(req.body.planName, "nome do plano", 2),
        amount,
        dueDay: Math.min(parsePositiveInteger(req.body.dueDay, "dia de vencimento"), 31),
        startDate: parseDateOnly(requiredString(req.body.startDate, "data de início")),
        status: req.body.status === "canceled" ? "CANCELED" : "ACTIVE",
        notes: optionalString(req.body.notes)
      },
      select: monthlyPlanSelect
    });

    res.json({ monthlyPlan: publicMonthlyPlan(plan) });
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    await findPlan(req.user.id, req.params.id);
    const plan = await prisma.monthlyPlan.update({
      where: { id: req.params.id },
      data: { status: "CANCELED", canceledAt: new Date() },
      select: monthlyPlanSelect
    });
    res.json({ monthlyPlan: publicMonthlyPlan(plan) });
  })
);

router.post(
  "/:id/payments",
  asyncHandler(async (req, res) => {
    const plan = await findPlan(req.user.id, req.params.id);
    const month = monthKey(req.body.month || todayString());
    const status = req.body.status === "paid" ? "PAID" : "PENDING";

    const payment = await prisma.monthlyPlanPayment.upsert({
      where: { monthlyPlanId_month: { monthlyPlanId: plan.id, month } },
      create: {
        monthlyPlanId: plan.id,
        month,
        status,
        paidAt: status === "PAID" ? new Date() : null,
        amount: plan.amount,
        manual: status !== "PAID"
      },
      update: {
        status,
        paidAt: status === "PAID" ? new Date() : null,
        amount: plan.amount,
        manual: status !== "PAID"
      },
      select: {
        month: true,
        status: true,
        paidAt: true,
        amount: true,
        manual: true
      }
    });

    const updatedPlan = {
      ...plan,
      payments: [...plan.payments.filter((item) => item.month !== month), payment]
    };

    res.json({ cycle: cycleForMonth(updatedPlan, month) });
  })
);

export default router;
