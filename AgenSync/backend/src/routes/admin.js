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
  businessName: true,
  businessType: true,
  createdAt: true,
  updatedAt: true
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
      email: true
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
    businessName: user.businessName,
    businessType: user.businessType,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
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
      newUsers7Days,
      newUsers30Days,
      admins,
      logins7Days,
      loginFailures7Days,
      adminAccess7Days,
      auditEvents7Days,
      clients,
      appointments,
      productSales,
      monthlyPlans,
      expenses,
      products
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: last7Days } } }),
      prisma.user.count({ where: { createdAt: { gte: last30Days } } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.auditLog.count({ where: { eventType: "auth.login_success", createdAt: { gte: last7Days } } }),
      prisma.auditLog.count({ where: { eventType: "auth.login_failed", createdAt: { gte: last7Days } } }),
      prisma.auditLog.count({ where: { eventType: "admin.access", createdAt: { gte: last7Days } } }),
      prisma.auditLog.groupBy({
        by: ["eventType"],
        where: { createdAt: { gte: last7Days } },
        _count: { eventType: true }
      }),
      prisma.client.count(),
      prisma.appointment.count(),
      prisma.productSale.count(),
      prisma.monthlyPlan.count(),
      prisma.expense.count(),
      prisma.product.count()
    ]);

    res.json({
      summary: {
        totalUsers,
        newUsers7Days,
        newUsers30Days,
        admins,
        logins7Days,
        loginFailures7Days,
        adminAccess7Days,
        records: {
          clients,
          appointments,
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

    const users = await prisma.user.findMany({
      ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : { take: 100 }),
      select: userSelect,
      orderBy: [{ createdAt: "desc" }]
    });

    res.json({ users: users.map(publicAdminUser) });
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
    const where = {};
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
