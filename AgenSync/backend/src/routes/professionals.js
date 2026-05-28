import bcrypt from "bcryptjs";
import { Router } from "express";
import { getPlanConfig } from "../config/plans.js";
import { invalidateAuthUserCache } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { recordAuditEvent } from "../utils/audit.js";
import { publicProfessional } from "../utils/formatters.js";
import {
  assertCanCreateProfessional,
  isWorkspaceProfessional,
  requireWorkspaceManager,
  workspaceWhere
} from "../utils/accessControl.js";
import {
  optionalEmail,
  optionalString,
  parseBoolean,
  parsePagination,
  parsePositiveMoney,
  requiredString,
  validateEmail
} from "../utils/validation.js";

const router = Router();
const accessRoles = new Set(["ADMIN", "PROFESSIONAL"]);

function includeStatsFromQuery(query) {
  return String(query?.includeStats || "").trim().toLowerCase() === "true";
}

async function professionalStatsById(req, professionalIds) {
  if (!professionalIds.length) return new Map();

  const baseWhere = workspaceWhere(req, {
    professionalId: { in: professionalIds }
  });
  const [totalRows, completedRows] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["professionalId"],
      where: baseWhere,
      _count: { _all: true }
    }),
    prisma.appointment.groupBy({
      by: ["professionalId"],
      where: { ...baseWhere, status: "COMPLETED" },
      _count: { _all: true },
      _sum: { price: true }
    })
  ]);
  const statsById = new Map(
    professionalIds.map((professionalId) => [
      professionalId,
      {
        total: 0,
        completed: 0,
        revenue: 0
      }
    ])
  );

  totalRows.forEach((row) => {
    if (!row.professionalId || !statsById.has(row.professionalId)) return;
    statsById.get(row.professionalId).total = row._count?._all || 0;
  });

  completedRows.forEach((row) => {
    if (!row.professionalId || !statsById.has(row.professionalId)) return;
    const stats = statsById.get(row.professionalId);
    stats.completed = row._count?._all || 0;
    stats.revenue = Number(row._sum?.price || 0);
  });

  return statsById;
}

async function findProfessionalOrFail(req, id) {
  const professional = await prisma.professional.findFirst({
    where: workspaceWhere(req, { id }),
    include: {
      workspaceMembers: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!professional) {
    throw new ApiError(404, "Profissional não encontrado.");
  }
  return professional;
}

function normalizeAccessRole(value) {
  const role = String(value || "PROFESSIONAL").trim().toUpperCase();
  if (!accessRoles.has(role)) {
    throw new ApiError(400, "Funcao de acesso invalida.");
  }
  return role;
}

function publicAccessMember(member) {
  if (!member) return null;
  return {
    id: member.id,
    userId: member.userId,
    name: member.user?.name || "",
    email: member.user?.email || "",
    role: String(member.role || "PROFESSIONAL").toLowerCase(),
    status: String(member.status || "ACTIVE").toLowerCase(),
    professionalId: member.professionalId || "",
    permissions: member.permissions && typeof member.permissions === "object" ? member.permissions : {},
    createdAt: member.createdAt,
    updatedAt: member.updatedAt
  };
}

async function ownerIdForWorkspace(workspaceId, fallbackUserId) {
  if (!workspaceId) return fallbackUserId;
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true }
  });
  return workspace?.ownerId || fallbackUserId;
}

async function assertCanCreateWorkspaceAccess(req, role) {
  const plan = req.plan || getPlanConfig(req.workspace?.plan);
  const now = new Date();
  const pendingInviteWhere = {
    workspaceId: req.workspaceId,
    status: "PENDING",
    expiresAt: { gt: now }
  };

  const [activeMembers, pendingInvites] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId: req.workspaceId, status: "ACTIVE" } }),
    prisma.workspaceInvite.count({ where: pendingInviteWhere })
  ]);

  if (activeMembers + pendingInvites >= Number(plan.maxUsers || 0)) {
    throw new ApiError(409, "Seu plano atual nao permite adicionar mais usuarios.");
  }

  if (role === "ADMIN") {
    const [activeAdmins, pendingAdminInvites] = await Promise.all([
      prisma.workspaceMember.count({ where: { workspaceId: req.workspaceId, role: "ADMIN", status: "ACTIVE" } }),
      prisma.workspaceInvite.count({ where: { ...pendingInviteWhere, role: "ADMIN" } })
    ]);

    if (activeAdmins + pendingAdminInvites >= Number(plan.maxAdmins || 0)) {
      throw new ApiError(409, `Seu plano permite ate ${plan.maxAdmins} administradores.`);
    }
  }
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where = workspaceWhere(req);
    if (isWorkspaceProfessional(req.user)) {
      if (!req.user.professionalId) {
        throw new ApiError(403, "Usuario profissional sem profissional vinculado.");
      }
      where.id = req.user.professionalId;
    }
    if (req.query.active === "true") {
      where.isActive = true;
    }
    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });

    const professionals = await prisma.professional.findMany({
      where,
      include: {
        workspaceMembers: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" }
        }
      },
      ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : {}),
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });
    const includeStats = includeStatsFromQuery(req.query);
    const statsById = includeStats
      ? await professionalStatsById(
          req,
          professionals.map((professional) => professional.id)
        )
      : new Map();
    const responseProfessionals = includeStats
      ? professionals.map((professional) => ({
          ...professional,
          stats: statsById.get(professional.id) || { total: 0, completed: 0, revenue: 0 }
        }))
      : professionals;

    res.json({ professionals: responseProfessionals.map(publicProfessional) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const name = requiredString(req.body.name, "nome", 2);
    const role = optionalString(req.body.role);
    const email = optionalEmail(req.body.email);
    const phone = optionalString(req.body.phone);
    const monthlyGoal =
      req.body.monthlyGoal === undefined || req.body.monthlyGoal === null || req.body.monthlyGoal === ""
        ? null
        : parsePositiveMoney(req.body.monthlyGoal, "meta mensal");
    const isActive = parseBoolean(req.body.isActive, true);

    await assertCanCreateProfessional(prisma, req.user, { active: isActive });

    const professional = await prisma.professional.create({
      data: { workspaceId: req.workspaceId || null, userId: req.user.id, name, role, email, phone, monthlyGoal, isActive }
    });

    res.status(201).json({ professional: publicProfessional(professional) });
  })
);

router.post(
  "/:id/access",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const professional = await findProfessionalOrFail(req, req.params.id);
    const existingAccess = professional.workspaceMembers?.find((member) => member.userId);
    if (existingAccess) {
      throw new ApiError(409, "Este profissional ja possui um usuario afiliado ativo.");
    }

    const email = validateEmail(req.body.email || professional.email);
    const password = requiredString(req.body.password, "senha", 6);
    const role = normalizeAccessRole(req.body.role || req.body.workspaceRole);
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      throw new ApiError(409, "Ja existe uma conta com esse email.");
    }

    await assertCanCreateWorkspaceAccess(req, role);

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: professional.name,
          email,
          passwordHash,
          role: "USER",
          workspaceRole: role,
          platformPlan: "padrao",
          subscriptionStatus: "PAID",
          billingEnabled: false,
          businessName: req.workspace?.name || req.user.businessName || `Agenda de ${professional.name}`,
          businessType: req.user.businessType || "Outro",
          currentWorkspaceId: req.workspaceId,
          professionalId: professional.id,
          onboardingCompleted: true,
          onboardingCompletedAt: new Date()
        }
      });

      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: req.workspaceId,
          userId: user.id,
          role,
          permissions: {},
          professionalId: professional.id,
          status: professional.isActive ? "ACTIVE" : "DISABLED"
        },
        include: {
          user: { select: { id: true, name: true, email: true } }
        }
      });

      const updatedProfessional = await tx.professional.update({
        where: { id: professional.id },
        data: { email },
        include: {
          workspaceMembers: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "asc" }
          }
        }
      });

      return { user, member, professional: updatedProfessional };
    });

    invalidateAuthUserCache(result.user.id);
    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "workspace.professional_access_created",
      message: "Usuario afiliado criado para profissional.",
      metadata: {
        workspaceId: req.workspaceId,
        professionalId: professional.id,
        memberId: result.member.id,
        targetUserId: result.user.id,
        targetEmail: result.user.email,
        role
      }
    });

    res.status(201).json({
      member: publicAccessMember(result.member),
      professional: publicProfessional(result.professional)
    });
  })
);

router.put(
  "/:id/access",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const professional = await findProfessionalOrFail(req, req.params.id);
    const currentAccess = professional.workspaceMembers?.find((member) => member.userId);
    if (!currentAccess) {
      throw new ApiError(404, "Este profissional ainda nao possui usuario afiliado.");
    }

    const name = optionalString(req.body.name);
    const email = req.body.email === undefined ? undefined : validateEmail(req.body.email);
    const password =
      req.body.password === undefined || req.body.password === null || req.body.password === ""
        ? ""
        : requiredString(req.body.password, "senha", 6);
    const role =
      req.body.role === undefined && req.body.workspaceRole === undefined
        ? String(currentAccess.role || "PROFESSIONAL").toUpperCase()
        : normalizeAccessRole(req.body.role || req.body.workspaceRole);

    if (email && email !== currentAccess.user?.email) {
      const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existingUser && existingUser.id !== currentAccess.userId) {
        throw new ApiError(409, "Ja existe uma conta com esse email.");
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : "";
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: currentAccess.userId },
        data: {
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
          ...(passwordHash ? { passwordHash } : {}),
          workspaceRole: role,
          professionalId: professional.id
        }
      });

      const updatedMember = await tx.workspaceMember.update({
        where: { id: currentAccess.id },
        data: {
          role,
          professionalId: professional.id,
          status: professional.isActive ? "ACTIVE" : "DISABLED"
        },
        include: {
          user: { select: { id: true, name: true, email: true } }
        }
      });

      const updatedProfessional = await tx.professional.update({
        where: { id: professional.id },
        data: {
          ...(name ? { name } : {}),
          ...(email ? { email } : {})
        },
        include: {
          workspaceMembers: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "asc" }
          }
        }
      });

      return { user: updatedUser, member: updatedMember, professional: updatedProfessional };
    });

    invalidateAuthUserCache(result.user.id);
    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "workspace.professional_access_updated",
      message: "Usuario afiliado do profissional atualizado.",
      metadata: {
        workspaceId: req.workspaceId,
        professionalId: professional.id,
        memberId: result.member.id,
        targetUserId: result.user.id,
        targetEmail: result.user.email,
        role
      }
    });

    res.json({
      member: publicAccessMember(result.member),
      professional: publicProfessional(result.professional)
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (isWorkspaceProfessional(req.user) && req.params.id !== req.user.professionalId) {
      throw new ApiError(403, "Voce so pode acessar seu proprio perfil profissional.");
    }
    const professional = await findProfessionalOrFail(req, req.params.id);
    res.json({ professional: publicProfessional(professional) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const current = await findProfessionalOrFail(req, req.params.id);

    const name = requiredString(req.body.name, "nome", 2);
    const role = optionalString(req.body.role);
    const email = optionalEmail(req.body.email);
    const phone = optionalString(req.body.phone);
    const monthlyGoal =
      req.body.monthlyGoal === undefined || req.body.monthlyGoal === null || req.body.monthlyGoal === ""
        ? null
        : parsePositiveMoney(req.body.monthlyGoal, "meta mensal");
    const isActive = parseBoolean(req.body.isActive, true);

    await assertCanCreateProfessional(prisma, req.user, {
      excludeProfessionalId: req.params.id,
      active: isActive
    });

    if (email && email !== current.email) {
      const accessUserIds = current.workspaceMembers.map((member) => member.userId).filter(Boolean);
      const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existingUser && !accessUserIds.includes(existingUser.id)) {
        throw new ApiError(409, "Ja existe uma conta com esse email.");
      }
    }

    const professional = await prisma.$transaction(async (tx) => {
      const updatedProfessional = await tx.professional.update({
        where: { id: req.params.id },
        data: { name, role, email, phone, monthlyGoal, isActive },
        include: {
          workspaceMembers: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "asc" }
          }
        }
      });

      const memberIds = updatedProfessional.workspaceMembers.map((member) => member.id);
      if (memberIds.length) {
        await tx.workspaceMember.updateMany({
          where: { id: { in: memberIds } },
          data: { status: isActive ? "ACTIVE" : "DISABLED" }
        });
      }

      const accessUser = updatedProfessional.workspaceMembers.find((member) => member.userId);
      if (accessUser?.userId && (name || email)) {
        await tx.user.update({
          where: { id: accessUser.userId },
          data: {
            ...(name ? { name } : {}),
            ...(email ? { email } : {})
          }
        });
      }

      return tx.professional.findUnique({
        where: { id: req.params.id },
        include: {
          workspaceMembers: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "asc" }
          }
        }
      });
    });

    professional.workspaceMembers.forEach((member) => invalidateAuthUserCache(member.userId));

    res.json({ professional: publicProfessional(professional) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const professional = await findProfessionalOrFail(req, req.params.id);
    const ownerId = await ownerIdForWorkspace(req.workspaceId, req.user.id);
    const accessUserIds = professional.workspaceMembers.map((member) => member.userId).filter(Boolean);

    await prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({
        where: workspaceWhere(req, { professionalId: req.params.id }),
        data: {
          userId: ownerId,
          professionalId: null
        }
      });

      await tx.monthlyPlan.updateMany({
        where: workspaceWhere(req, { professionalId: req.params.id }),
        data: { professionalId: null }
      });

      await tx.workspaceMember.updateMany({
        where: { professionalId: req.params.id },
        data: {
          professionalId: null,
          status: "DISABLED"
        }
      });

      await tx.workspaceInvite.updateMany({
        where: { professionalId: req.params.id },
        data: { professionalId: null }
      });

      await tx.professional.delete({ where: { id: req.params.id } });
    });

    accessUserIds.forEach((userId) => invalidateAuthUserCache(userId));
    res.status(204).send();
    return;

    const appointments = await prisma.appointment.count({
      where: workspaceWhere(req, { professionalId: req.params.id })
    });

    if (appointments > 0) {
      throw new ApiError(409, "Não é possível excluir profissional com agendamentos. Desative-o para ocultar na criação.");
    }

    await prisma.professional.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
