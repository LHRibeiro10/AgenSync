import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { invalidateAuthUserCache } from "../middleware/auth.js";
import { PLAN_SLUGS, normalizePlanSlug } from "../config/plans.js";
import { recordAuditEvent } from "../utils/audit.js";
import { endOfDay, endOfMonth, formatDate, parseDateOnly, startOfDay, startOfMonth, todayString } from "../utils/dates.js";

const router = Router();

const subscriptionStatuses = new Set(["PAID", "TRIAL", "PAST_DUE", "CANCELED"]);
const accountStatuses = new Set(["ACTIVE", "INACTIVE", "BLOCKED"]);
const userStatuses = new Set(["ACTIVE", "INACTIVE"]);

async function syncPrimaryWorkspaceForUser(userId, data) {
  if (!userId || !data || !Object.keys(data).length) return;
  try {
    await prisma.workspace.updateMany({ where: { ownerId: userId }, data });
  } catch (error) {
    if (String(error?.code || "") !== "P2021" && String(error?.code || "") !== "P2022") {
      throw error;
    }
  }
}

const workspaceSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  workspaceRole: true,
  platformRole: true,
  platformPlan: true,
  accountStatus: true,
  userStatus: true,
  subscriptionStatus: true,
  subscriptionPaidUntil: true,
  temporaryAccessUntil: true,
  billingEnabled: true,
  businessName: true,
  businessType: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      clients: true,
      professionals: true,
      appointments: true,
      services: true,
      products: true,
      monthlyPlans: true
    }
  }
};

function normalizeUpper(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePlan(value) {
  return normalizePlanSlug(value);
}

function decimalNumber(value) {
  return Number(value || 0);
}

function platformUserWhere() {
  return {
    OR: [
      { platformRole: null },
      { platformRole: { notIn: ["DEVELOPER", "PLATFORM_OWNER"] } }
    ]
  };
}

function resolvePeriod(query) {
  const now = new Date();
  const key = String(query.period || "month").trim().toLowerCase();

  if (key === "today") {
    const selected = parseDateOnly(query.date || todayString());
    return { key, start: startOfDay(selected), end: endOfDay(selected) };
  }

  if (key === "7d" || key === "last7days") {
    const end = endOfDay(now);
    const start = startOfDay(now);
    start.setDate(start.getDate() - 6);
    return { key: "7d", start, end };
  }

  if (key === "last_month") {
    const base = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { key, start: startOfMonth(base), end: endOfMonth(base) };
  }

  if (key === "custom") {
    const start = startOfDay(parseDateOnly(query.startDate, "data inicial"));
    const end = endOfDay(parseDateOnly(query.endDate, "data final"));
    if (end <= start) throw new ApiError(400, "Periodo personalizado invalido.");
    return { key, start, end };
  }

  return { key: "month", start: startOfMonth(now), end: endOfMonth(now) };
}

function eachDay(start, end) {
  const days = [];
  const cursor = startOfDay(start);
  while (cursor < end) {
    days.push(formatDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function publicWorkspace(user, extras = {}) {
  return {
    id: user.id,
    name: user.businessName || user.name,
    ownerName: user.name,
    ownerEmail: user.email,
    plan: normalizePlanSlug(user.platformPlan),
    businessType: user.businessType,
    status: String(user.accountStatus || "ACTIVE").toLowerCase(),
    userStatus: String(user.userStatus || "ACTIVE").toLowerCase(),
    subscriptionStatus: String(user.subscriptionStatus || "PAID").toLowerCase(),
    subscriptionPaidUntil: user.subscriptionPaidUntil || null,
    temporaryAccessUntil: user.temporaryAccessUntil || null,
    billingEnabled: Boolean(user.billingEnabled),
    workspaceRole: String(user.workspaceRole || "OWNER").toLowerCase(),
    platformRole: user.platformRole ? String(user.platformRole).toLowerCase() : "",
    counts: {
      users: extras.users ?? 1,
      professionals: extras.professionals ?? user._count?.professionals ?? 0,
      admins: extras.admins ?? (String(user.workspaceRole || "OWNER") === "ADMIN" ? 1 : 0),
      appointments: extras.appointments ?? user._count?.appointments ?? 0,
      clients: user._count?.clients ?? 0,
      services: user._count?.services ?? 0,
      products: user._count?.products ?? 0,
      monthlyPlans: user._count?.monthlyPlans ?? 0
    },
    financial: {
      gross: extras.gross ?? 0,
      appointmentRevenue: extras.appointmentRevenue ?? 0,
      salesRevenue: extras.salesRevenue ?? 0,
      expenses: extras.expenses ?? 0,
      net: extras.net ?? 0,
      estimatedMrr: extras.estimatedMrr ?? 0
    },
    lastLoginAt: extras.lastLoginAt || null,
    lastActivityAt: extras.lastActivityAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function financialByWorkspace(userIds, period) {
  if (!userIds.length) return new Map();

  const [appointments, sales, expenses, monthlyPlans] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "COMPLETED", startsAt: { gte: period.start, lt: period.end } },
      _sum: { price: true },
      _count: { id: true }
    }),
    prisma.productSale.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, date: { gte: period.start, lt: period.end } },
      _sum: { total: true }
    }),
    prisma.expense.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, date: { gte: period.start, lt: period.end } },
      _sum: { amount: true }
    }),
    prisma.monthlyPlan.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "ACTIVE" },
      _sum: { amount: true }
    })
  ]);

  const map = new Map(userIds.map((id) => [id, { appointmentRevenue: 0, salesRevenue: 0, expenses: 0, appointments: 0, estimatedMrr: 0 }]));
  appointments.forEach((item) => {
    const current = map.get(item.userId);
    current.appointmentRevenue = decimalNumber(item._sum.price);
    current.appointments = item._count.id || 0;
  });
  sales.forEach((item) => {
    map.get(item.userId).salesRevenue = decimalNumber(item._sum.total);
  });
  expenses.forEach((item) => {
    map.get(item.userId).expenses = decimalNumber(item._sum.amount);
  });
  monthlyPlans.forEach((item) => {
    map.get(item.userId).estimatedMrr = decimalNumber(item._sum.amount);
  });

  map.forEach((value) => {
    value.gross = value.appointmentRevenue + value.salesRevenue;
    value.net = value.gross - value.expenses;
  });

  return map;
}

async function activityByWorkspace(userIds) {
  if (!userIds.length) return new Map();

  const [lastLogins, lastActivities] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, eventType: "auth.login_success" },
      _max: { createdAt: true }
    }),
    prisma.auditLog.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _max: { createdAt: true }
    })
  ]);

  const map = new Map(userIds.map((id) => [id, { lastLoginAt: null, lastActivityAt: null }]));
  lastLogins.forEach((item) => {
    map.get(item.userId).lastLoginAt = item._max.createdAt || null;
  });
  lastActivities.forEach((item) => {
    map.get(item.userId).lastActivityAt = item._max.createdAt || null;
  });
  return map;
}

async function loadWorkspaceRows(period, options = {}) {
  const search = String(options.search || "").trim();
  const plan = options.plan ? normalizePlanSlug(options.plan) : "";
  const status = String(options.status || "").trim().toUpperCase();

  const searchWhere = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { businessName: { contains: search, mode: "insensitive" } },
          { platformPlan: { contains: search, mode: "insensitive" } }
        ]
      }
    : null;
  const planWhere = plan
    ? plan === PLAN_SLUGS.PADRAO
      ? { OR: [{ platformPlan: plan }, { platformPlan: null }, { platformPlan: "" }] }
      : { platformPlan: plan }
    : null;

  const where = {
    AND: [
      platformUserWhere(),
      ...(searchWhere ? [searchWhere] : []),
      ...(planWhere ? [planWhere] : [])
    ],
    ...(subscriptionStatuses.has(status) ? { subscriptionStatus: status } : {})
  };

  const users = await prisma.user.findMany({
    where,
    select: workspaceSelect,
    take: Math.min(Number(options.take || 250) || 250, 500),
    orderBy: [{ createdAt: "desc" }]
  });

  const ids = users.map((user) => user.id);
  const [financialMap, activityMap] = await Promise.all([financialByWorkspace(ids, period), activityByWorkspace(ids)]);

  const rows = users.map((user) => publicWorkspace(user, {
    ...(financialMap.get(user.id) || {}),
    ...(activityMap.get(user.id) || {})
  }));

  const sort = String(options.sort || "createdAt").trim();
  const direction = String(options.direction || "desc").toLowerCase() === "asc" ? 1 : -1;
  const sorters = {
    revenue: (row) => row.financial.gross,
    users: (row) => row.counts.users,
    professionals: (row) => row.counts.professionals,
    appointments: (row) => row.counts.appointments,
    createdAt: (row) => new Date(row.createdAt).getTime()
  };
  const sorter = sorters[sort] || sorters.createdAt;
  rows.sort((first, second) => (sorter(first) - sorter(second)) * direction);

  return rows;
}

function sumRows(rows, path) {
  return rows.reduce((total, row) => {
    const value = path.split(".").reduce((current, key) => current?.[key], row);
    return total + Number(value || 0);
  }, 0);
}

function groupRows(rows, getter, valueGetter = () => 1) {
  const map = new Map();
  rows.forEach((row) => {
    const key = getter(row) || "Sem plano";
    map.set(key, (map.get(key) || 0) + Number(valueGetter(row) || 0));
  });
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

router.use(
  asyncHandler(async (req, res, next) => {
    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "platform.access",
      message: "Acesso a rota da plataforma."
    });
    next();
  })
);

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const period = resolvePeriod(req.query);
    const rows = await loadWorkspaceRows(period);
    const [totalUsers, totalProfessionals, totalAdmins, subscriptionsByStatus, subscribersCreated] = await Promise.all([
      prisma.user.count({ where: platformUserWhere() }),
      prisma.professional.count(),
      prisma.user.count({ where: { ...platformUserWhere(), workspaceRole: "ADMIN" } }),
      prisma.user.groupBy({ by: ["subscriptionStatus"], where: platformUserWhere(), _count: { id: true } }),
      prisma.user.groupBy({
        by: ["createdAt"],
        where: { ...platformUserWhere(), createdAt: { gte: period.start, lt: period.end } },
        _count: { id: true }
      })
    ]);

    const statusCount = Object.fromEntries(subscriptionsByStatus.map((item) => [String(item.subscriptionStatus).toLowerCase(), item._count.id]));
    const days = eachDay(period.start, period.end);
    const growthMap = new Map(days.map((day) => [day, 0]));
    subscribersCreated.forEach((item) => {
      const key = formatDate(item.createdAt);
      growthMap.set(key, (growthMap.get(key) || 0) + item._count.id);
    });

    const summary = {
      totalSubscribers: totalUsers,
      activeSubscriptions: statusCount.paid || 0,
      overdueSubscriptions: (statusCount.past_due || 0) + (statusCount.canceled || 0),
      trialAccounts: statusCount.trial || 0,
      estimatedMrr: sumRows(rows, "financial.estimatedMrr"),
      totalWorkspaces: rows.length,
      totalUsers,
      totalProfessionals,
      totalAdmins,
      appointmentsInPeriod: sumRows(rows, "counts.appointments"),
      totalMovedBySubscribers: sumRows(rows, "financial.gross"),
      grossRevenueMoved: sumRows(rows, "financial.gross"),
      expensesRegistered: sumRows(rows, "financial.expenses"),
      estimatedNetMoved: sumRows(rows, "financial.net")
    };

    res.json({
      period: { key: period.key, startDate: formatDate(period.start), endDate: formatDate(new Date(period.end.getTime() - 1)) },
      summary,
      charts: {
        subscribersByPlan: groupRows(rows, (row) => row.plan),
        estimatedRevenueByPlan: groupRows(rows, (row) => row.plan, (row) => row.financial.estimatedMrr),
        subscriberGrowth: [...growthMap.entries()].map(([label, value]) => ({ label, value })),
        professionalsByAccount: rows.map((row) => ({ label: row.name, value: row.counts.professionals })).sort((a, b) => b.value - a.value).slice(0, 10),
        usersByAccount: rows.map((row) => ({ label: row.name, value: row.counts.users })).sort((a, b) => b.value - a.value).slice(0, 10),
        financialMovement: rows.map((row) => ({ label: row.name, value: row.financial.gross })).sort((a, b) => b.value - a.value).slice(0, 10),
        topRevenueAccounts: rows.slice().sort((a, b) => b.financial.gross - a.financial.gross).slice(0, 10),
        topProfessionalAccounts: rows.slice().sort((a, b) => b.counts.professionals - a.counts.professionals).slice(0, 10),
        topAppointmentAccounts: rows.slice().sort((a, b) => b.counts.appointments - a.counts.appointments).slice(0, 10)
      }
    });
  })
);

router.get(
  "/metrics",
  asyncHandler(async (req, res) => {
    req.url = `/overview?${new URLSearchParams(req.query).toString()}`;
    router.handle(req, res);
  })
);

router.get(
  "/workspaces",
  asyncHandler(async (req, res) => {
    const period = resolvePeriod(req.query);
    const workspaces = await loadWorkspaceRows(period, req.query);
    res.json({ workspaces, period: { key: period.key, startDate: formatDate(period.start), endDate: formatDate(new Date(period.end.getTime() - 1)) } });
  })
);

router.get(
  "/workspaces/:id",
  asyncHandler(async (req, res) => {
    const period = resolvePeriod(req.query);
    const user = await prisma.user.findFirst({ where: { id: req.params.id, ...platformUserWhere() }, select: workspaceSelect });
    if (!user) throw new ApiError(404, "Conta nao encontrada.");
    const [financialMap, activityMap, users, professionals] = await Promise.all([
      financialByWorkspace([user.id], period),
      activityByWorkspace([user.id]),
      prisma.user.findMany({
        where: { id: user.id },
        select: { id: true, name: true, email: true, workspaceRole: true, platformRole: true, userStatus: true, createdAt: true }
      }),
      prisma.professional.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, role: true, phone: true, isActive: true, createdAt: true },
        orderBy: [{ isActive: "desc" }, { name: "asc" }]
      })
    ]);

    res.json({
      workspace: publicWorkspace(user, {
        ...(financialMap.get(user.id) || {}),
        ...(activityMap.get(user.id) || {})
      }),
      users: users.map((item) => ({
        ...item,
        workspaceRole: String(item.workspaceRole || "OWNER").toLowerCase(),
        platformRole: item.platformRole ? String(item.platformRole).toLowerCase() : "",
        userStatus: String(item.userStatus || "ACTIVE").toLowerCase()
      })),
      professionals
    });
  })
);

router.patch(
  "/workspaces/:id/status",
  asyncHandler(async (req, res) => {
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 5) throw new ApiError(400, "Informe um motivo com pelo menos 5 caracteres.");

    const data = {};
    const accountStatus = normalizeUpper(req.body.accountStatus || req.body.status);
    const subscriptionStatus = normalizeUpper(req.body.subscriptionStatus);
    if (accountStatus) {
      if (!accountStatuses.has(accountStatus)) throw new ApiError(400, "Status operacional invalido.");
      data.accountStatus = accountStatus;
    }
    if (subscriptionStatus) {
      if (!subscriptionStatuses.has(subscriptionStatus)) throw new ApiError(400, "Status de assinatura invalido.");
      data.subscriptionStatus = subscriptionStatus;
    }
    if (req.body.temporaryAccessUntil !== undefined) {
      data.temporaryAccessUntil = req.body.temporaryAccessUntil ? new Date(req.body.temporaryAccessUntil) : null;
    }
    if (!Object.keys(data).length) throw new ApiError(400, "Nenhuma alteracao de status enviada.");

    const current = await prisma.user.findFirst({ where: { id: req.params.id, ...platformUserWhere() }, select: { id: true } });
    if (!current) throw new ApiError(404, "Conta nao encontrada.");
    const user = await prisma.user.update({ where: { id: req.params.id }, data, select: workspaceSelect });
    await syncPrimaryWorkspaceForUser(user.id, {
      ...(data.subscriptionStatus ? { planStatus: data.subscriptionStatus } : {})
    });
    invalidateAuthUserCache(user.id);
    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "platform.workspace_status_changed",
      message: reason,
      metadata: { targetUserId: user.id, data }
    });
    res.json({ workspace: publicWorkspace(user) });
  })
);

router.patch(
  "/workspaces/:id/plan",
  asyncHandler(async (req, res) => {
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 5) throw new ApiError(400, "Informe um motivo com pelo menos 5 caracteres.");
    const platformPlan = normalizePlan(req.body.plan || req.body.platformPlan);

    const current = await prisma.user.findFirst({ where: { id: req.params.id, ...platformUserWhere() }, select: { id: true } });
    if (!current) throw new ApiError(404, "Conta nao encontrada.");
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { platformPlan }, select: workspaceSelect });
    await syncPrimaryWorkspaceForUser(user.id, { plan: platformPlan });
    invalidateAuthUserCache(user.id);
    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "platform.workspace_plan_changed",
      message: reason,
      metadata: { targetUserId: user.id, platformPlan }
    });
    res.json({ workspace: publicWorkspace(user) });
  })
);

router.patch(
  "/users/:id/status",
  asyncHandler(async (req, res) => {
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 5) throw new ApiError(400, "Informe um motivo com pelo menos 5 caracteres.");
    const userStatus = normalizeUpper(req.body.status || req.body.userStatus);
    if (!userStatuses.has(userStatus)) throw new ApiError(400, "Status de usuario invalido.");
    if (req.params.id === req.user.id && userStatus !== "ACTIVE") {
      throw new ApiError(400, "Voce nao pode inativar seu proprio usuario.");
    }

    const current = await prisma.user.findFirst({ where: { id: req.params.id, ...platformUserWhere() }, select: { id: true } });
    if (!current) throw new ApiError(404, "Usuario nao encontrado.");

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { userStatus },
      select: { id: true, name: true, email: true, workspaceRole: true, platformRole: true, userStatus: true, createdAt: true }
    });
    invalidateAuthUserCache(user.id);
    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "platform.user_status_changed",
      message: reason,
      metadata: { targetUserId: user.id, userStatus }
    });
    res.json({
      user: {
        ...user,
        workspaceRole: String(user.workspaceRole || "OWNER").toLowerCase(),
        platformRole: user.platformRole ? String(user.platformRole).toLowerCase() : "",
        userStatus: String(user.userStatus || "ACTIVE").toLowerCase()
      }
    });
  })
);

export default router;
