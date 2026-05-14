import { Router } from "express";
import { prisma } from "../prisma.js";
import { invalidateAuthUserCache } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { publicAuditLog, recordAuditEvent } from "../utils/audit.js";
import { parsePagination, requiredString } from "../utils/validation.js";

const router = Router();

const userSelect = {
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
      appointments: true,
      services: true,
      products: true,
      monthlyPlans: true
    }
  }
};

const auditSelect = {
  id: true,
  userId: true,
  email: true,
  eventType: true,
  message: true,
  ipAddress: true,
  userAgent: true,
  route: true,
  metadata: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  }
};

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function publicAdminUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: String(user.role || "USER").toLowerCase(),
    workspaceRole: String(user.workspaceRole || "OWNER").toLowerCase(),
    platformRole: user.platformRole ? String(user.platformRole).toLowerCase() : "",
    subscriptionStatus: String(user.subscriptionStatus || "PAID").toLowerCase(),
    subscriptionPaidUntil: user.subscriptionPaidUntil || null,
    billingEnabled: Boolean(user.billingEnabled),
    businessName: user.businessName,
    businessType: user.businessType,
    counts: user.counts || {
      clients: user._count?.clients || 0,
      appointments: user._count?.appointments || 0,
      services: user._count?.services || 0,
      products: user._count?.products || 0,
      monthlyPlans: user._count?.monthlyPlans || 0
    },
    lastLoginAt: user.lastLoginAt || null,
    lastActivityAt: user.lastActivityAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function normalizeUserRoleFilter(value) {
  const role = String(value || "user").trim().toLowerCase();
  if (role === "all" || role === "todos") return null;
  if (role === "admin") return "ADMIN";
  return "USER";
}

function normalizeRole(value) {
  const role = requiredString(value, "role").trim().toLowerCase();
  if (role === "admin") return "ADMIN";
  if (role === "user") return "USER";
  throw new ApiError(400, "Role invalida.");
}

router.use(
  asyncHandler(async (req, res, next) => {
    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "admin.access",
      message: "Acesso a rota administrativa."
    });
    next();
  })
);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const last7Days = daysAgo(7);
    const last30Days = daysAgo(30);

    const [
      totalUsers,
      commonUsers,
      newUsers7Days,
      newUsers30Days,
      admins,
      logins7Days,
      loginFailures7Days,
      adminAccess7Days,
      auditEvents7Days,
      activeUsers30Days,
      businesses,
      clients,
      appointments,
      services,
      productSales,
      monthlyPlans,
      expenses,
      products
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "USER" } }),
      prisma.user.count({ where: { createdAt: { gte: last7Days } } }),
      prisma.user.count({ where: { createdAt: { gte: last30Days } } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.auditLog.count({
        where: { eventType: "auth.login_success", createdAt: { gte: last7Days }, user: { is: { role: "USER" } } }
      }),
      prisma.auditLog.count({
        where: { eventType: "auth.login_failed", createdAt: { gte: last7Days }, user: { is: { role: "USER" } } }
      }),
      prisma.auditLog.count({
        where: { eventType: "admin.access", createdAt: { gte: last7Days }, user: { is: { role: "USER" } } }
      }),
      prisma.auditLog.groupBy({
        by: ["eventType"],
        where: { createdAt: { gte: last7Days }, user: { is: { role: "USER" } } },
        _count: { eventType: true }
      }),
      prisma.auditLog.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: last30Days }, userId: { not: null }, user: { is: { role: "USER" } } },
        _count: { userId: true }
      }),
      prisma.user.findMany({
        where: { role: "USER" },
        distinct: ["businessName"],
        select: { businessName: true }
      }),
      prisma.client.count(),
      prisma.appointment.count(),
      prisma.service.count(),
      prisma.productSale.count(),
      prisma.monthlyPlan.count(),
      prisma.expense.count(),
      prisma.product.count()
    ]);

    res.json({
      summary: {
        totalUsers,
        commonUsers,
        newUsers7Days,
        newUsers30Days,
        activeUsers30Days: activeUsers30Days.length,
        businesses: businesses.filter((item) => item.businessName).length,
        admins,
        logins7Days,
        loginFailures7Days,
        adminAccess7Days,
        records: {
          clients,
          appointments,
          services,
          productSales,
          monthlyPlans,
          expenses,
          products
        },
        events7Days: auditEvents7Days
          .map((item) => ({ eventType: item.eventType, count: item._count.eventType }))
          .sort((first, second) => second.count - first.count)
      }
    });
  })
);

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query, {
      defaultPageSize: 100,
      maxPageSize: 300
    });

    const search = String(req.query.search || "").trim();
    const roleFilter = normalizeUserRoleFilter(req.query.role);
    const where = {
      id: { not: req.user.id },
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { businessName: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const users = await prisma.user.findMany({
      where,
      ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : { take: 100 }),
      select: userSelect,
      orderBy: [{ createdAt: "desc" }]
    });

    const userIds = users.map((user) => user.id);
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

    const loginByUser = new Map(lastLogins.map((item) => [item.userId, item._max.createdAt]));
    const activityByUser = new Map(lastActivities.map((item) => [item.userId, item._max.createdAt]));

    res.json({
      users: users.map((user) =>
        publicAdminUser({
          ...user,
          lastLoginAt: loginByUser.get(user.id) || null,
          lastActivityAt: activityByUser.get(user.id) || null
        })
      )
    });
  })
);

router.patch(
  "/users/:id/role",
  asyncHandler(async (req, res) => {
    const role = normalizeRole(req.body.role);

    if (req.params.id === req.user.id && role !== "ADMIN") {
      throw new ApiError(400, "Voce nao pode remover seu proprio acesso admin.");
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, role: true }
    });
    if (!currentUser) throw new ApiError(404, "Usuario nao encontrado.");

    if (currentUser.role === "ADMIN" && role !== "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) throw new ApiError(400, "Nao e possivel remover o ultimo admin.");
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: userSelect
    });

    invalidateAuthUserCache(user.id);

    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "admin.role_changed",
      message: `Role alterada para ${role.toLowerCase()}.`,
      metadata: {
        targetUserId: user.id,
        targetEmail: user.email,
        previousRole: currentUser.role,
        nextRole: role
      }
    });

    res.json({ user: publicAdminUser(user) });
  })
);

router.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query, {
      defaultPageSize: 100,
      maxPageSize: 300
    });
    const where = {
      userId: { not: req.user.id },
      user: { is: { role: "USER" } }
    };
    if (req.query.eventType) where.eventType = String(req.query.eventType);

    const logs = await prisma.auditLog.findMany({
      where,
      ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : { take: 100 }),
      select: auditSelect,
      orderBy: [{ createdAt: "desc" }]
    });

    res.json({ logs: logs.map(publicAuditLog) });
  })
);

export default router;
