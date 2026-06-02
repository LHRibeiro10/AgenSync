import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { PLAN_FEATURES, planHasFeature } from "../config/plans.js";
import { isWorkspaceProfessional, professionalWhere, resolveProfessionalScope, workspaceWhere } from "../utils/accessControl.js";
import {
  endOfDay,
  endOfMonth,
  formatDate,
  parseDateOnly,
  startOfDay,
  startOfMonth,
  startOfWeek,
  todayString
} from "../utils/dates.js";
import { publicAppointment, publicExpense, publicProductSale, publicMonthlyPlan } from "../utils/formatters.js";

const router = Router();
const FINANCE_OVERVIEW_CACHE_TTL_MS = 10_000;
const FINANCE_OVERVIEW_CACHE_MAX_ITEMS = 200;
const financeOverviewCache = new Map();

const clientSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  notes: true,
  createdAt: true,
  updatedAt: true
};

const serviceSelect = {
  id: true,
  name: true,
  priceDefault: true,
  durationMinutes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};

const professionalSelect = {
  id: true,
  name: true,
  role: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};

const appointmentSelect = {
  id: true,
  clientId: true,
  serviceId: true,
  professionalId: true,
  monthlyPlanId: true,
  startsAt: true,
  endsAt: true,
  durationMinutes: true,
  price: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  client: { select: clientSelect },
  service: { select: serviceSelect },
  professional: { select: professionalSelect },
  monthlyPlan: {
    select: {
      id: true,
      planName: true,
      billingType: true,
      status: true
    }
  }
};

const productSaleSelect = {
  id: true,
  productId: true,
  clientId: true,
  productName: true,
  unitPrice: true,
  unitCost: true,
  quantity: true,
  total: true,
  date: true,
  notes: true,
  createdAt: true,
  client: {
    select: {
      id: true,
      name: true
    }
  }
};

const paymentSelect = {
  id: true,
  month: true,
  status: true,
  dueDate: true,
  paidAt: true,
  amount: true,
  paymentMethod: true,
  notes: true,
  manual: true,
  createdAt: true,
  updatedAt: true
};

const monthlyPlanSelect = {
  id: true,
  userId: true,
  clientId: true,
  serviceId: true,
  professionalId: true,
  planName: true,
  amount: true,
  dueDay: true,
  startDate: true,
  endDate: true,
  billingType: true,
  priceMode: true,
  monthlyPrice: true,
  sessionPrice: true,
  sessionsPerMonth: true,
  recurrenceType: true,
  recurrenceConfig: true,
  defaultStartTime: true,
  durationMinutes: true,
  generateAppointments: true,
  generatedUntil: true,
  status: true,
  pausedAt: true,
  canceledAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  service: { select: serviceSelect },
  professional: { select: professionalSelect },
  payments: {
    select: paymentSelect,
    orderBy: [{ month: "desc" }]
  }
};

const FIXED_BILLING_TYPES = new Set(["FIXED_MONTHLY", "PACKAGE_MONTHLY"]);
const pad = (value) => String(value).padStart(2, "0");

async function revenue(req, startsAt, scope) {
  const result = await prisma.appointment.aggregate({
    where: {
      ...workspaceWhere(req),
      ...professionalWhere(scope),
      status: "COMPLETED",
      startsAt
    },
    _sum: { price: true }
  });

  return Number(result._sum.price || 0);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function monthKey(value = todayString()) {
  return String(value).slice(0, 7);
}

function monthEndDate(month) {
  const [year, number] = month.split("-").map(Number);
  return new Date(year, number, 0).getDate();
}

function endOfMonthKey(month) {
  return `${month}-${pad(monthEndDate(month))}`;
}

function dueDateForMonth(month, dueDay) {
  return `${month}-${pad(Math.max(1, Math.min(Number(dueDay || 1), monthEndDate(month))))}`;
}

function startOfMonthKey(value) {
  const [year, number] = monthKey(value).split("-").map(Number);
  return new Date(year, number - 1, 1);
}

function nextMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function isFixedBilling(plan) {
  return FIXED_BILLING_TYPES.has(plan.billingType || "FIXED_MONTHLY");
}

function shouldIncludePlan(plan, month) {
  if (!isFixedBilling(plan)) return false;
  if (month < monthKey(formatDate(plan.startDate))) return false;
  if (plan.endDate && month > monthKey(formatDate(plan.endDate))) return false;
  if (plan.status === "CANCELED" && plan.canceledAt && month > monthKey(formatDate(plan.canceledAt))) return false;
  return true;
}

function cycleForMonth(plan, month) {
  const publicPlan = publicMonthlyPlan(plan);
  const payment = publicPlan.payments.find((item) => item.month === month);
  const dueDate = payment?.dueDate || dueDateForMonth(month, publicPlan.dueDay);
  const rawStatus = payment?.status || "pending";
  const status = rawStatus === "paid" || rawStatus === "canceled" ? rawStatus : dueDate < todayString() ? "overdue" : rawStatus;

  return {
    id: payment?.id || `${publicPlan.id}_${month}`,
    subscriptionId: publicPlan.id,
    clientId: publicPlan.clientId,
    clientName: publicPlan.clientName,
    planName: publicPlan.planName,
    billingType: publicPlan.billingType,
    amount: payment?.amount ?? publicPlan.monthlyPrice ?? publicPlan.amount,
    dueDay: publicPlan.dueDay,
    dueDate,
    month,
    status,
    paidAt: payment?.paidAt || "",
    paymentMethod: payment?.paymentMethod || "",
    notes: payment?.notes || "",
    subscriptionStatus: publicPlan.status,
    planNotes: publicPlan.notes
  };
}

function cyclesForRange(plans, startDate, endDate) {
  const cycles = [];
  plans.forEach((plan) => {
    let cursor = startOfMonthKey(startDate);
    const end = startOfMonthKey(endDate);
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

function occurrenceDateForMonth(startDate, monthDate) {
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const day = Math.min(startDate.getDate(), lastDay);
  return new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
}

function expandRecurringExpense(expense, startDate, endDate) {
  if (expense.recurrence !== "MONTHLY") return [publicExpense(expense)];
  if (formatDate(endDate) < formatDate(expense.date)) return [];

  const start = startOfMonthKey(formatDate(startDate < expense.date ? expense.date : startDate));
  const end = startOfMonthKey(formatDate(endDate));
  const items = [];
  let cursor = start;

  while (cursor <= end) {
    const occurrence = occurrenceDateForMonth(expense.date, cursor);
    if (occurrence >= expense.date && occurrence >= startDate && occurrence <= endDate) {
      items.push({
        ...publicExpense({ ...expense, date: occurrence }),
        id: `${expense.id}_${monthKey(formatDate(occurrence))}`,
        sourceId: expense.id,
        originalDate: formatDate(expense.date),
        isRecurringOccurrence: true
      });
    }
    cursor = nextMonth(cursor);
  }

  return items;
}

function getCachedOverview(key) {
  const cached = financeOverviewCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    financeOverviewCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedOverview(key, value) {
  if (financeOverviewCache.size >= FINANCE_OVERVIEW_CACHE_MAX_ITEMS) {
    const oldestKey = financeOverviewCache.keys().next().value;
    if (oldestKey) financeOverviewCache.delete(oldestKey);
  }

  financeOverviewCache.set(key, {
    value,
    expiresAt: Date.now() + FINANCE_OVERVIEW_CACHE_TTL_MS
  });
}

async function appointmentsForRange(req, scope, { startDate, endDate, status = "" }) {
  return prisma.appointment.findMany({
    where: {
      ...workspaceWhere(req),
      ...professionalWhere(scope),
      ...(status ? { status } : {}),
      startsAt: {
        gte: startOfDay(parseDateOnly(startDate, "data inicial")),
        lt: endOfDay(parseDateOnly(endDate, "data final"))
      }
    },
    select: appointmentSelect,
    orderBy: [{ startsAt: "asc" }]
  });
}

async function salesForRange(req, { startDate, endDate }) {
  const sales = await prisma.productSale.findMany({
    where: {
      ...workspaceWhere(req),
      date: {
        gte: startOfDay(parseDateOnly(startDate, "data inicial")),
        lt: endOfDay(parseDateOnly(endDate, "data final"))
      }
    },
    select: productSaleSelect,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }]
  });

  return sales.map(publicProductSale);
}

async function expensesForRange(req, { startDate, endDate, category = "" }) {
  const rangeStart = startOfDay(parseDateOnly(startDate, "data inicial"));
  const rangeEnd = startOfDay(parseDateOnly(endDate, "data final"));
  const expenses = await prisma.expense.findMany({
    where: {
      ...workspaceWhere(req),
      ...(category ? { category } : {}),
      OR: [
        { recurrence: "MONTHLY", date: { lte: rangeEnd } },
        { recurrence: "ONCE", date: { gte: rangeStart, lte: rangeEnd } }
      ]
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }]
  });

  return expenses
    .flatMap((expense) => expandRecurringExpense(expense, rangeStart, rangeEnd))
    .sort((first, second) => `${second.date}${second.createdAt}`.localeCompare(`${first.date}${first.createdAt}`));
}

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const endDate = String(req.query.endDate || req.query.date || todayString()).slice(0, 10);
    const startDate = String(req.query.startDate || `${endDate.slice(0, 7)}-01`).slice(0, 10);
    const selectedDate = parseDateOnly(endDate);
    const currentWeekStart = formatDate(addDays(selectedDate, -6));
    const previousStart = formatDate(addDays(selectedDate, -13));
    const previousEnd = formatDate(addDays(selectedDate, -7));
    const selectedMonth = monthKey(endDate);
    const monthRange = { startDate: `${selectedMonth}-01`, endDate };
    const canFilterProfessionals =
      isWorkspaceProfessional(req.user) || planHasFeature(req.user, PLAN_FEATURES.PROFESSIONAL_FILTERS);
    const scope = await resolveProfessionalScope(
      prisma,
      req.user,
      canFilterProfessionals ? req.query.professionalId : ""
    );
    const professionalScope = Boolean(scope.professionalId);
    const category = String(req.query.category || "");
    const cacheKey = [
      req.workspaceId || req.user.id,
      startDate,
      endDate,
      previousStart,
      previousEnd,
      scope.professionalId || "all",
      category || "all"
    ].join(":");
    const cached = getCachedOverview(cacheKey);
    if (cached) return res.json(cached);

    const dateValue = parseDateOnly(endDate);
    const dayStart = startOfDay(dateValue);
    const dayEnd = endOfDay(dateValue);
    const weekStart = startOfWeek(dateValue);
    const monthStart = startOfMonth(dateValue);
    const monthEnd = endOfMonth(dateValue);
    const scopeWhere = professionalWhere(scope);

    const [
      today,
      week,
      month,
      completedMonth,
      completedAppointments,
      previousWeekCompleted,
      periodSales,
      monthSales,
      currentWeekSales,
      previousWeekSales,
      periodExpenses,
      monthExpenses,
      monthlyPlans
    ] = await Promise.all([
      revenue(req, { gte: dayStart, lt: dayEnd }, scope),
      revenue(req, { gte: weekStart, lt: dayEnd }, scope),
      revenue(req, { gte: monthStart, lt: monthEnd }, scope),
      prisma.appointment.count({
        where: {
          ...workspaceWhere(req),
          ...scopeWhere,
          status: "COMPLETED",
          startsAt: { gte: monthStart, lt: monthEnd }
        }
      }),
      appointmentsForRange(req, scope, { startDate, endDate, status: "COMPLETED" }),
      appointmentsForRange(req, scope, { startDate: previousStart, endDate: previousEnd, status: "COMPLETED" }),
      professionalScope ? Promise.resolve([]) : salesForRange(req, { startDate, endDate }),
      professionalScope ? Promise.resolve([]) : salesForRange(req, monthRange),
      professionalScope ? Promise.resolve([]) : salesForRange(req, { startDate: currentWeekStart, endDate }),
      professionalScope ? Promise.resolve([]) : salesForRange(req, { startDate: previousStart, endDate: previousEnd }),
      professionalScope ? Promise.resolve([]) : expensesForRange(req, { startDate, endDate, category }),
      professionalScope ? Promise.resolve([]) : expensesForRange(req, { ...monthRange, category }),
      professionalScope
        ? Promise.resolve([])
        : prisma.monthlyPlan.findMany({
            where: { ...workspaceWhere(req) },
            select: monthlyPlanSelect,
            orderBy: [{ createdAt: "desc" }]
          })
    ]);

    const periodSubscriptions = professionalScope ? [] : cyclesForRange(monthlyPlans, startDate, endDate);
    const todaySubscriptions = professionalScope ? [] : cyclesForRange(monthlyPlans, endDate, endDate);
    const monthSubscriptions = professionalScope ? [] : cyclesForRange(monthlyPlans, monthRange.startDate, monthRange.endDate);
    const currentWeekSubscriptions = professionalScope ? [] : cyclesForRange(monthlyPlans, currentWeekStart, endDate);
    const previousWeekSubscriptions = professionalScope ? [] : cyclesForRange(monthlyPlans, previousStart, previousEnd);

    const payload = {
      filters: {
        startDate,
        endDate,
        category,
        professionalId: scope.professionalId || ""
      },
      finance: {
        totalReceivedToday: today,
        totalReceivedWeek: week,
        totalReceivedMonth: month,
        completedAppointmentsMonth: completedMonth
      },
      appointments: {
        completed: completedAppointments.map(publicAppointment),
        previousWeekCompleted: previousWeekCompleted.map(publicAppointment)
      },
      sales: {
        period: periodSales,
        today: periodSales.filter((sale) => sale.date === endDate),
        month: monthSales,
        currentWeek: currentWeekSales,
        previousWeek: previousWeekSales
      },
      subscriptions: {
        period: periodSubscriptions,
        today: todaySubscriptions,
        month: monthSubscriptions,
        currentWeek: currentWeekSubscriptions,
        previousWeek: previousWeekSubscriptions
      },
      expenses: {
        period: periodExpenses,
        today: periodExpenses.filter((expense) => expense.date === endDate),
        month: monthExpenses
      }
    };

    setCachedOverview(cacheKey, payload);
    res.json(payload);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const selectedDate = parseDateOnly(req.query.date || todayString());
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    const weekStart = startOfWeek(selectedDate);
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const canFilterProfessionals =
      isWorkspaceProfessional(req.user) || planHasFeature(req.user, PLAN_FEATURES.PROFESSIONAL_FILTERS);
    const scope = await resolveProfessionalScope(
      prisma,
      req.user,
      canFilterProfessionals ? req.query.professionalId : ""
    );
    const scopeWhere = professionalWhere(scope);

    const [today, week, month, completedMonth] = await Promise.all([
      revenue(req, { gte: dayStart, lt: dayEnd }, scope),
      revenue(req, { gte: weekStart, lt: dayEnd }, scope),
      revenue(req, { gte: monthStart, lt: monthEnd }, scope),
      prisma.appointment.count({
        where: {
          ...workspaceWhere(req),
          ...scopeWhere,
          status: "COMPLETED",
          startsAt: { gte: monthStart, lt: monthEnd }
        }
      })
    ]);

    res.json({
      totalReceivedToday: today,
      totalReceivedWeek: week,
      totalReceivedMonth: month,
      completedAppointmentsMonth: completedMonth
    });
  })
);

export default router;
