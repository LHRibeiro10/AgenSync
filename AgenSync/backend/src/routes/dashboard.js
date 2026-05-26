import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { PLAN_FEATURES, planHasFeature } from "../config/plans.js";
import {
  endOfDay,
  endOfMonth,
  formatDate,
  parseDateOnly,
  startOfDay,
  startOfMonth,
  todayString
} from "../utils/dates.js";
import { isWorkspaceProfessional, professionalWhere, resolveProfessionalScope, workspaceWhere } from "../utils/accessControl.js";
import { publicAppointment, publicExpense, publicMonthlyPlan, publicProductSale } from "../utils/formatters.js";

const router = Router();
const DASHBOARD_CACHE_TTL_MS = 10_000;
const DASHBOARD_CACHE_MAX_ITEMS = 200;
const dashboardCache = new Map();

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
  userId: true,
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
const emptySubscriptionSummary = {
  activeCount: 0,
  pausedCount: 0,
  sessionsExpected: 0,
  sessionsCompleted: 0,
  pending: 0,
  overdue: 0,
  paid: 0,
  expected: 0,
  received: 0,
  pendingAmount: 0,
  cycles: []
};

const pad = (value) => String(value).padStart(2, "0");

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function daysBetween(startDate, endDate) {
  return Math.max(1, Math.round((parseDateOnly(endDate) - parseDateOnly(startDate)) / 86400000) + 1);
}

function previousRange(startDate, endDate) {
  const amount = daysBetween(startDate, endDate);
  const previousEnd = addDays(parseDateOnly(startDate), -1);
  const previousStart = addDays(previousEnd, -(amount - 1));
  return {
    startDate: formatDate(previousStart),
    endDate: formatDate(previousEnd)
  };
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

async function listAppointmentsForRange(reqOrUser, { startDate, endDate, professionalId = "", status = "" }) {
  return prisma.appointment.findMany({
    where: {
      ...workspaceWhere(reqOrUser),
      ...(professionalId ? { professionalId } : {}),
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

async function listSalesForRange(reqOrUser, { startDate, endDate }) {
  const sales = await prisma.productSale.findMany({
    where: {
      ...workspaceWhere(reqOrUser),
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

async function listExpensesForRange(reqOrUser, { startDate, endDate }) {
  const rangeStart = startOfDay(parseDateOnly(startDate, "data inicial"));
  const rangeEnd = startOfDay(parseDateOnly(endDate, "data final"));
  const expenses = await prisma.expense.findMany({
    where: {
      ...workspaceWhere(reqOrUser),
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

function buildSubscriptionSummary(plans, appointments, cycles) {
  const perSessionAppointments = appointments.filter(
    (appointment) => appointment.monthlyPlan?.billingType === "PER_COMPLETED_SESSION" && appointment.status !== "CANCELED"
  );
  const completedPerSessionAppointments = perSessionAppointments.filter((appointment) => appointment.status === "COMPLETED");
  const expectedFromSessions = perSessionAppointments.reduce((total, appointment) => total + Number(appointment.price || 0), 0);
  const receivedFromSessions = completedPerSessionAppointments.reduce((total, appointment) => total + Number(appointment.price || 0), 0);
  const expectedFromFixed = cycles.reduce((total, cycle) => total + Number(cycle.amount || 0), 0);
  const receivedFromFixed = cycles
    .filter((cycle) => cycle.status === "paid")
    .reduce((total, cycle) => total + Number(cycle.amount || 0), 0);

  return {
    activeCount: plans.filter((plan) => plan.status === "ACTIVE").length,
    pausedCount: plans.filter((plan) => plan.status === "PAUSED").length,
    sessionsExpected: appointments.filter((appointment) => appointment.status !== "CANCELED").length,
    sessionsCompleted: appointments.filter((appointment) => appointment.status === "COMPLETED").length,
    pending: cycles.filter((cycle) => cycle.status === "pending").length,
    overdue: cycles.filter((cycle) => cycle.status === "overdue").length,
    paid: cycles.filter((cycle) => cycle.status === "paid").length,
    expected: expectedFromFixed + expectedFromSessions,
    received: receivedFromFixed + receivedFromSessions,
    pendingAmount: Math.max(expectedFromFixed + expectedFromSessions - receivedFromFixed - receivedFromSessions, 0),
    cycles
  };
}

function getCachedDashboard(key) {
  const cached = dashboardCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    dashboardCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedDashboard(key, value) {
  if (dashboardCache.size >= DASHBOARD_CACHE_MAX_ITEMS) {
    const oldestKey = dashboardCache.keys().next().value;
    if (oldestKey) dashboardCache.delete(oldestKey);
  }

  dashboardCache.set(key, {
    value,
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS
  });
}

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const startDate = String(req.query.startDate || req.query.date || todayString()).slice(0, 10);
    const endDate = String(req.query.endDate || req.query.date || startDate).slice(0, 10);
    const start = parseDateOnly(startDate, "data inicial");
    const end = parseDateOnly(endDate, "data final");
    if (start > end) throw new ApiError(400, "A data inicial precisa ser anterior a data final.");

    const canFilterProfessionals =
      isWorkspaceProfessional(req.user) || planHasFeature(req.user, PLAN_FEATURES.PROFESSIONAL_FILTERS);
    const scope = await resolveProfessionalScope(
      prisma,
      req.user,
      canFilterProfessionals ? req.query.professionalId : ""
    );
    const professionalId = scope.professionalId;
    const includeTeam =
      req.query.includeTeam === "true" &&
      !scope.restricted &&
      planHasFeature(req.user, PLAN_FEATURES.TEAM_COMPARISON);
    const comparison =
      req.query.comparisonStartDate && req.query.comparisonEndDate
        ? {
            startDate: String(req.query.comparisonStartDate).slice(0, 10),
            endDate: String(req.query.comparisonEndDate).slice(0, 10)
          }
        : previousRange(startDate, endDate);
    const tomorrow = String(req.query.tomorrowDate || formatDate(addDays(parseDateOnly(todayString()), 1))).slice(0, 10);
    const selectedDate = parseDateOnly(endDate);
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const selectedMonth = monthKey(endDate);
    const monthRange = { startDate: `${selectedMonth}-01`, endDate };
    const summaryRange = { startDate: `${selectedMonth}-01`, endDate: endOfMonthKey(selectedMonth) };
    const scopedProfessionalWhere = professionalWhere(scope);
    const isRestrictedProfessional = scope.restricted === true;
    const cacheKey = [
      "overview",
      req.workspaceId || req.user.id,
      startDate,
      endDate,
      comparison.startDate,
      comparison.endDate,
      tomorrow,
      professionalId || "all",
      includeTeam ? "team" : "self"
    ].join(":");
    const cached = getCachedDashboard(cacheKey);
    if (cached) return res.json(cached);

    const [
      todayAppointments,
      todayRevenue,
      monthRevenue,
      nextAppointment,
      periodAppointments,
      previousAppointments,
      tomorrowAppointments,
      teamAppointments,
      monthlyPlans,
      monthlyPlanAppointments,
      periodSales,
      monthSales,
      comparisonSales,
      periodExpenses,
      monthExpenses,
      comparisonExpenses
    ] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          ...workspaceWhere(req),
          ...scopedProfessionalWhere,
          startsAt: { gte: dayStart, lt: dayEnd }
        },
        select: appointmentSelect,
        orderBy: [{ startsAt: "asc" }]
      }),
      prisma.appointment.aggregate({
        where: {
          ...workspaceWhere(req),
          ...scopedProfessionalWhere,
          status: "COMPLETED",
          startsAt: { gte: dayStart, lt: dayEnd }
        },
        _sum: { price: true }
      }),
      prisma.appointment.aggregate({
        where: {
          ...workspaceWhere(req),
          ...scopedProfessionalWhere,
          status: "COMPLETED",
          startsAt: { gte: monthStart, lt: monthEnd }
        },
        _sum: { price: true }
      }),
      prisma.appointment.findFirst({
        where: {
          ...workspaceWhere(req),
          ...scopedProfessionalWhere,
          status: "SCHEDULED",
          startsAt: { gte: new Date() }
        },
        select: appointmentSelect,
        orderBy: [{ startsAt: "asc" }]
      }),
      listAppointmentsForRange(req, { startDate, endDate, professionalId }),
      listAppointmentsForRange(req, {
        startDate: comparison.startDate,
        endDate: comparison.endDate,
        professionalId,
        status: "COMPLETED"
      }),
      listAppointmentsForRange(req, { startDate: tomorrow, endDate: tomorrow, professionalId }),
      includeTeam && professionalId ? listAppointmentsForRange(req, { startDate, endDate }) : Promise.resolve(null),
      isRestrictedProfessional
        ? Promise.resolve([])
        : prisma.monthlyPlan.findMany({
            where: { ...workspaceWhere(req), ...scopedProfessionalWhere },
            select: monthlyPlanSelect,
            orderBy: [{ createdAt: "desc" }]
          }),
      isRestrictedProfessional
        ? Promise.resolve([])
        : prisma.appointment.findMany({
            where: {
              ...workspaceWhere(req),
              ...scopedProfessionalWhere,
              monthlyPlanId: { not: null },
              startsAt: {
                gte: startOfDay(parseDateOnly(summaryRange.startDate)),
                lt: endOfDay(parseDateOnly(summaryRange.endDate))
              }
            },
            select: {
              id: true,
              monthlyPlanId: true,
              startsAt: true,
              status: true,
              price: true,
              monthlyPlan: { select: { billingType: true } }
            }
          }),
      isRestrictedProfessional ? Promise.resolve([]) : listSalesForRange(req, { startDate, endDate }),
      isRestrictedProfessional ? Promise.resolve([]) : listSalesForRange(req, monthRange),
      isRestrictedProfessional ? Promise.resolve([]) : listSalesForRange(req, comparison),
      isRestrictedProfessional ? Promise.resolve([]) : listExpensesForRange(req, { startDate, endDate }),
      isRestrictedProfessional ? Promise.resolve([]) : listExpensesForRange(req, monthRange),
      isRestrictedProfessional ? Promise.resolve([]) : listExpensesForRange(req, comparison)
    ]);

    const periodSubscriptions = isRestrictedProfessional ? [] : cyclesForRange(monthlyPlans, startDate, endDate);
    const daySubscriptions = isRestrictedProfessional ? [] : cyclesForRange(monthlyPlans, endDate, endDate);
    const monthSubscriptions = isRestrictedProfessional ? [] : cyclesForRange(monthlyPlans, monthRange.startDate, monthRange.endDate);
    const comparisonSubscriptions = isRestrictedProfessional
      ? []
      : cyclesForRange(monthlyPlans, comparison.startDate, comparison.endDate);
    const summaryCycles = isRestrictedProfessional
      ? []
      : cyclesForRange(monthlyPlans, summaryRange.startDate, summaryRange.endDate);

    const payload = {
      filters: {
        startDate,
        endDate,
        comparison,
        monthRange,
        summaryRange,
        tomorrow,
        professionalId
      },
      dashboard: {
        date: endDate,
        appointmentsToday: todayAppointments.length,
        earnedToday: Number(todayRevenue._sum.price || 0),
        earnedMonth: Number(monthRevenue._sum.price || 0),
        nextAppointment: nextAppointment ? publicAppointment(nextAppointment) : null,
        todayAppointments: todayAppointments.map(publicAppointment)
      },
      appointments: {
        period: periodAppointments.map(publicAppointment),
        previous: previousAppointments.map(publicAppointment),
        tomorrow: tomorrowAppointments.map(publicAppointment),
        team: teamAppointments ? teamAppointments.map(publicAppointment) : null
      },
      sales: {
        period: periodSales,
        month: monthSales,
        comparison: comparisonSales
      },
      expenses: {
        period: periodExpenses,
        month: monthExpenses,
        comparison: comparisonExpenses
      },
      subscriptions: {
        period: periodSubscriptions,
        day: daySubscriptions,
        month: monthSubscriptions,
        comparison: comparisonSubscriptions,
        summary: isRestrictedProfessional
          ? emptySubscriptionSummary
          : buildSubscriptionSummary(monthlyPlans, monthlyPlanAppointments, summaryCycles)
      }
    };

    setCachedDashboard(cacheKey, payload);
    res.json(payload);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const dateParam = req.query.date || todayString();
    const canFilterProfessionals =
      isWorkspaceProfessional(req.user) || planHasFeature(req.user, PLAN_FEATURES.PROFESSIONAL_FILTERS);
    const scope = await resolveProfessionalScope(
      prisma,
      req.user,
      canFilterProfessionals ? req.query.professionalId : ""
    );
    const professionalId = scope.professionalId;
    const cacheKey = `${req.workspaceId || req.user.id}:${dateParam}:${professionalId || "all"}`;
    const cached = getCachedDashboard(cacheKey);
    if (cached) return res.json(cached);

    const selectedDate = parseDateOnly(dateParam);
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const scopedProfessionalWhere = professionalWhere(scope);

    const [todayAppointments, todayRevenue, monthRevenue, nextAppointment] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          ...workspaceWhere(req),
          ...scopedProfessionalWhere,
          startsAt: { gte: dayStart, lt: dayEnd }
        },
        select: appointmentSelect,
        orderBy: [{ startsAt: "asc" }]
      }),
      prisma.appointment.aggregate({
        where: {
          ...workspaceWhere(req),
          ...scopedProfessionalWhere,
          status: "COMPLETED",
          startsAt: { gte: dayStart, lt: dayEnd }
        },
        _sum: { price: true }
      }),
      prisma.appointment.aggregate({
        where: {
          ...workspaceWhere(req),
          ...scopedProfessionalWhere,
          status: "COMPLETED",
          startsAt: { gte: monthStart, lt: monthEnd }
        },
        _sum: { price: true }
      }),
      prisma.appointment.findFirst({
        where: {
          ...workspaceWhere(req),
          ...scopedProfessionalWhere,
          status: "SCHEDULED",
          startsAt: { gte: new Date() }
        },
        select: appointmentSelect,
        orderBy: [{ startsAt: "asc" }]
      })
    ]);

    const payload = {
      date: dateParam,
      appointmentsToday: todayAppointments.length,
      earnedToday: Number(todayRevenue._sum.price || 0),
      earnedMonth: Number(monthRevenue._sum.price || 0),
      nextAppointment: nextAppointment ? publicAppointment(nextAppointment) : null,
      todayAppointments: todayAppointments.map(publicAppointment)
    };

    setCachedDashboard(cacheKey, payload);
    res.json(payload);
  })
);

export default router;
