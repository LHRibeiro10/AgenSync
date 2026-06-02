import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { PLAN_FEATURES, PLAN_SLUGS, getPlanConfig, planHasFeature } from "../config/plans.js";
import { invalidateAuthUserCache, requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { prisma } from "../prisma.js";
import { publicAuditLog, recordAuditEvent } from "../utils/audit.js";
import {
  requireWorkspaceAccess,
  requireWorkspaceManager,
  requireWorkspaceOwner
} from "../utils/accessControl.js";
import { normalizeEnvValue } from "../utils/env.js";
import { publicProfessional, publicUser } from "../utils/formatters.js";
import { hydrateUserWorkspace } from "../utils/workspaceContext.js";
import { optionalString, parsePagination, requiredString, validateEmail } from "../utils/validation.js";

const router = Router();
const TEAM_OVERVIEW_CACHE_TTL_MS = Math.max(5_000, Number(process.env.TEAM_OVERVIEW_CACHE_TTL_MS || 10_000));
const TEAM_OVERVIEW_CACHE_MAX_ITEMS = Math.max(50, Number(process.env.TEAM_OVERVIEW_CACHE_MAX_ITEMS || 200));
const teamOverviewCache = new Map();

const INVITE_TTL_DAYS = 7;
const INITIAL_ADMIN_EMAIL = "luiz.henrique.ribeiro770@gmail.com";

const inviteRoles = new Set(["ADMIN", "PROFESSIONAL"]);
const memberStatuses = new Set(["ACTIVE", "DISABLED"]);
const specialWorkspacePermissions = new Set([
  "canViewGeneralFinance",
  "canManageTeamSchedule",
  "canManageClients",
  "canManageServices",
  "canViewReports",
  "canExportReports",
  "canManageProducts",
  "canManageInventory",
  "canManageDocuments",
  "canManageBudgets",
  "canManageSubscriptions",
  "canViewTeamGoals",
  "canCreateSales",
  "canViewSalesReports"
]);
const criticalPermissions = new Set([
  "manageBilling",
  "changePlan",
  "deleteWorkspace",
  "transferOwnership",
  "manageCriticalSettings"
]);

const auditSelect = {
  id: true,
  workspaceId: true,
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

function jwtSecret() {
  const secret = normalizeEnvValue(process.env.JWT_SECRET);
  if (!secret) {
    throw new ApiError(500, "JWT_SECRET nao configurado no backend.");
  }
  return secret;
}

function signToken(userId) {
  return jwt.sign({ userId }, jwtSecret(), { expiresIn: "7d" });
}

function roleForEmail(email) {
  return String(email || "").trim().toLowerCase() === INITIAL_ADMIN_EMAIL ? "ADMIN" : "USER";
}

function normalizeRole(value, { allowOwner = false, fallback = "" } = {}) {
  const role = String(value || fallback || "").trim().toUpperCase();
  if (!role) throw new ApiError(400, "Perfil do usuario e obrigatorio.");
  if (role === "OWNER" && !allowOwner) {
    throw new ApiError(403, "Transferencia de proprietario ficara para uma etapa futura.");
  }
  if (!["OWNER", "ADMIN", "PROFESSIONAL"].includes(role)) {
    throw new ApiError(400, "Perfil do usuario invalido.");
  }
  return role;
}

function normalizeInviteRole(value) {
  const role = normalizeRole(value);
  if (!inviteRoles.has(role)) {
    throw new ApiError(400, "Convites podem criar apenas admins ou profissionais nesta etapa.");
  }
  return role;
}

function normalizeMemberStatus(value, fallback = "ACTIVE") {
  const status = String(value || fallback || "").trim().toUpperCase();
  if (!memberStatuses.has(status)) {
    throw new ApiError(400, "Status do membro invalido.");
  }
  return status;
}

function normalizePermissions(plan, rawPermissions) {
  const planConfig = plan?.features ? plan : getPlanConfig(plan);
  if (!planHasFeature(planConfig, PLAN_FEATURES.SPECIAL_PERMISSIONS)) {
    return {};
  }

  const source = Array.isArray(rawPermissions)
    ? Object.fromEntries(rawPermissions.map((permission) => [permission, true]))
    : rawPermissions && typeof rawPermissions === "object"
      ? rawPermissions
      : {};

  return Object.fromEntries(
    Object.entries(source)
      .filter(([key, value]) => specialWorkspacePermissions.has(key) && !criticalPermissions.has(key) && value === true)
      .map(([key]) => [key, true])
  );
}

function normalizeInvitePhone(value) {
  const phone = requiredString(value, "telefone", 8).replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 15) {
    throw new ApiError(400, "Telefone do WhatsApp invalido.");
  }
  return phone;
}

function expiresAtFromNow() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
  return expiresAt;
}

function isExpired(invite, now = new Date()) {
  return Boolean(invite?.expiresAt && new Date(invite.expiresAt).getTime() <= now.getTime());
}

function tokenFromRequest(req) {
  return requiredString(req.params?.token || req.body?.token, "token do convite");
}

function inviteOrigin(req) {
  return normalizeEnvValue(process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "") || String(req.get("origin") || "").replace(/\/$/, "");
}

function inviteUrl(req, token) {
  const origin = inviteOrigin(req);
  return origin ? `${origin}/accept-invite/${encodeURIComponent(token)}` : `/accept-invite/${encodeURIComponent(token)}`;
}

function publicInvite(invite, req) {
  const expired = isExpired(invite);
  const status = expired && invite.status === "PENDING" ? "EXPIRED" : invite.status;

  return {
    id: invite.id,
    workspaceId: invite.workspaceId,
    workspaceName: invite.workspace?.name || "",
    email: invite.email,
    phone: invite.phone || "",
    name: invite.name || "",
    role: String(invite.role || "PROFESSIONAL").toLowerCase(),
    permissions: invite.permissions && typeof invite.permissions === "object" ? invite.permissions : {},
    professionalId: invite.professionalId || "",
    professionalName: invite.professional?.name || "",
    status: String(status || "PENDING").toLowerCase(),
    invitedById: invite.invitedById || "",
    invitedByName: invite.invitedBy?.name || "",
    invitedByEmail: invite.invitedBy?.email || "",
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt || null,
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
    inviteUrl: invite.status === "PENDING" && !expired ? inviteUrl(req, invite.token) : ""
  };
}

function publicMember(member) {
  return {
    id: member.id,
    workspaceId: member.workspaceId,
    userId: member.userId,
    name: member.user?.name || "",
    email: member.user?.email || "",
    role: String(member.role || "PROFESSIONAL").toLowerCase(),
    permissions: member.permissions && typeof member.permissions === "object" ? member.permissions : {},
    professionalId: member.professionalId || "",
    professionalName: member.professional?.name || "",
    status: String(member.status || "ACTIVE").toLowerCase(),
    createdAt: member.createdAt,
    updatedAt: member.updatedAt
  };
}

function teamOverviewCacheKey(req) {
  return JSON.stringify({
    workspaceId: req.workspaceId || "",
    userId: req.user?.id || "",
    includeAudit: String(req.query?.includeAudit || "").trim().toLowerCase() === "true",
    auditTake: req.query?.take || ""
  });
}

function getCachedTeamOverview(key) {
  const cached = teamOverviewCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    teamOverviewCache.delete(key);
    return null;
  }
  return cached.value;
}

function setTeamOverviewCache(key, value) {
  if (teamOverviewCache.size >= TEAM_OVERVIEW_CACHE_MAX_ITEMS) {
    const oldestKey = teamOverviewCache.keys().next().value;
    if (oldestKey) teamOverviewCache.delete(oldestKey);
  }
  teamOverviewCache.set(key, {
    value,
    expiresAt: Date.now() + TEAM_OVERVIEW_CACHE_TTL_MS
  });
}

export function clearTeamOverviewCache() {
  teamOverviewCache.clear();
}

function optionalAuth(req, res, next) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) {
    next();
    return;
  }
  requireAuth(req, res, next);
}

async function expireOldInvites(workspaceId = "") {
  await prisma.workspaceInvite.updateMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      status: "PENDING",
      expiresAt: { lte: new Date() }
    },
    data: { status: "EXPIRED" }
  });
}

async function loadInviteByToken(token) {
  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    include: {
      workspace: true,
      professional: { select: { id: true, name: true } },
      invitedBy: { select: { id: true, name: true, email: true } }
    }
  });

  if (invite && invite.status === "PENDING" && isExpired(invite)) {
    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" }
    });
    return { ...invite, status: "EXPIRED" };
  }

  return invite;
}

async function assertProfessionalBelongsToWorkspace(professionalId, workspaceId) {
  if (!professionalId) return null;

  const professional = await prisma.professional.findFirst({
    where: { id: String(professionalId), workspaceId, isActive: true },
    select: { id: true, name: true }
  });

  if (!professional) {
    throw new ApiError(404, "Profissional nao encontrado neste workspace.");
  }

  return professional;
}

async function assertWorkspaceCapacity({
  workspaceId,
  plan,
  role = "",
  addsUser = false,
  needsNewProfessional = false,
  excludeInviteId = "",
  excludeMemberId = ""
}) {
  const now = new Date();
  const planConfig = plan?.features ? plan : getPlanConfig(plan);
  const pendingInviteWhere = {
    workspaceId,
    status: "PENDING",
    expiresAt: { gt: now },
    ...(excludeInviteId ? { id: { not: excludeInviteId } } : {})
  };

  if (addsUser) {
    const [activeMembers, pendingInvites] = await Promise.all([
      prisma.workspaceMember.count({
        where: {
          workspaceId,
          status: "ACTIVE",
          ...(excludeMemberId ? { id: { not: excludeMemberId } } : {})
        }
      }),
      prisma.workspaceInvite.count({ where: pendingInviteWhere })
    ]);

    if (activeMembers + pendingInvites >= Number(planConfig.maxUsers || 0)) {
      throw new ApiError(409, "Seu plano atual nao permite adicionar mais usuarios.");
    }
  }

  if (role === "ADMIN") {
    const [activeAdmins, pendingAdminInvites] = await Promise.all([
      prisma.workspaceMember.count({
        where: {
          workspaceId,
          role: "ADMIN",
          status: "ACTIVE",
          ...(excludeMemberId ? { id: { not: excludeMemberId } } : {})
        }
      }),
      prisma.workspaceInvite.count({ where: { ...pendingInviteWhere, role: "ADMIN" } })
    ]);

    if (activeAdmins + pendingAdminInvites >= Number(planConfig.maxAdmins || 0)) {
      throw new ApiError(409, `Seu plano permite ate ${planConfig.maxAdmins} administradores.`);
    }
  }

  if (needsNewProfessional) {
    const [activeProfessionals, pendingProfessionalInvites] = await Promise.all([
      prisma.professional.count({ where: { workspaceId, isActive: true } }),
      prisma.workspaceInvite.count({
        where: {
          ...pendingInviteWhere,
          role: "PROFESSIONAL",
          professionalId: null
        }
      })
    ]);

    if (activeProfessionals + pendingProfessionalInvites >= Number(planConfig.maxProfessionals || 0)) {
      throw new ApiError(409, `Seu plano permite ate ${planConfig.maxProfessionals} profissionais.`);
    }
  }
}

async function findMemberOrFail(workspaceId, id) {
  const member = await prisma.workspaceMember.findFirst({
    where: { id, workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      professional: { select: { id: true, name: true } }
    }
  });

  if (!member) {
    throw new ApiError(404, "Membro nao encontrado neste workspace.");
  }

  return member;
}

function assertCanManageTargetMember(req, member, { ownerOnly = false } = {}) {
  if (ownerOnly) {
    requireWorkspaceOwner(req);
  } else {
    requireWorkspaceManager(req);
  }

  const requesterRole = String(req.workspaceRole || req.user?.workspaceRole || "").toUpperCase();
  const targetRole = String(member.role || "").toUpperCase();

  if (targetRole === "OWNER") {
    throw new ApiError(403, "O proprietario unico nao pode ser alterado por aqui.");
  }

  if (requesterRole === "ADMIN" && targetRole !== "PROFESSIONAL") {
    throw new ApiError(403, "Admins so podem gerenciar profissionais nesta etapa.");
  }

  if (member.userId === req.user.id) {
    throw new ApiError(400, "Voce nao pode alterar seu proprio acesso por aqui.");
  }
}

router.get(
  "/invites/validate/:token",
  asyncHandler(async (req, res) => {
    const token = tokenFromRequest(req);
    const invite = await loadInviteByToken(token);

    if (!invite) {
      res.json({ invite: { valid: false, status: "invalid", expired: false } });
      return;
    }

    const expired = isExpired(invite);
    const valid = invite.status === "PENDING" && !expired;
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true }
    });

    res.json({
      invite: {
        valid,
        expired,
        status: String(expired && invite.status === "PENDING" ? "EXPIRED" : invite.status).toLowerCase(),
        workspaceName: invite.workspace?.name || "",
        email: invite.email,
        phone: invite.phone || "",
        name: invite.name || "",
        role: String(invite.role || "PROFESSIONAL").toLowerCase(),
        professionalName: invite.professional?.name || "",
        existingUser: Boolean(existingUser)
      }
    });
  })
);

router.post(
  "/invites/accept",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const token = tokenFromRequest(req);
    const invite = await loadInviteByToken(token);
    if (!invite) throw new ApiError(404, "Convite nao encontrado.");
    if (invite.status !== "PENDING" || isExpired(invite)) {
      throw new ApiError(400, "Este convite nao esta mais disponivel.");
    }

    const inviteEmail = String(invite.email || "").trim().toLowerCase();
    let user = null;
    let newUserData = null;
    const requestedName = optionalString(req.body.name) || invite.name || "";

    if (req.user?.id) {
      if (String(req.user.email || "").trim().toLowerCase() !== inviteEmail) {
        throw new ApiError(403, "Este convite pertence a outro email.");
      }
      user = await prisma.user.findUnique({ where: { id: req.user.id } });
    } else {
      const existingUser = await prisma.user.findUnique({ where: { email: inviteEmail } });
      if (existingUser) {
        const password = requiredString(req.body.password, "senha");
        if (existingUser.passwordHash === "supabase-auth") {
          throw new ApiError(401, "Entre com esta conta antes de aceitar o convite.");
        }
        const validPassword = await bcrypt.compare(password, existingUser.passwordHash);
        if (!validPassword) {
          throw new ApiError(401, "Email ou senha invalidos.");
        }
        user = existingUser;
      } else {
        const name = requiredString(requestedName, "nome", 2);
        const password = requiredString(req.body.password, "senha", 6);
        const passwordHash = await bcrypt.hash(password, 10);
        newUserData = {
          name,
          email: inviteEmail,
          passwordHash,
          role: roleForEmail(inviteEmail),
          workspaceRole: invite.role,
          platformPlan: PLAN_SLUGS.PADRAO,
          subscriptionStatus: "PAID",
          billingEnabled: false,
          businessName: invite.workspace?.name || `Agenda de ${name}`,
          businessType: "Outro",
          onboardingCompleted: true,
          onboardingCompletedAt: new Date()
        };
      }
    }

    if (!user && !newUserData) throw new ApiError(401, "Nao foi possivel identificar o usuario do convite.");

    if (user) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: user.id
          }
        }
      });
      if (existingMember) {
        throw new ApiError(409, "Este usuario ja faz parte deste workspace.");
      }
    }

    if (invite.professionalId) {
      await assertProfessionalBelongsToWorkspace(invite.professionalId, invite.workspaceId);
    }

    await assertWorkspaceCapacity({
      workspaceId: invite.workspaceId,
      plan: getPlanConfig(invite.workspace?.plan),
      role: invite.role,
      addsUser: true,
      needsNewProfessional: invite.role === "PROFESSIONAL" && !invite.professionalId,
      excludeInviteId: invite.id
    });

    const accepted = await prisma.$transaction(async (tx) => {
      const acceptedUser = user || (await tx.user.create({ data: newUserData }));
      let professionalId = invite.professionalId || null;

      if (invite.role === "PROFESSIONAL" && !professionalId) {
        const professional = await tx.professional.create({
          data: {
            workspaceId: invite.workspaceId,
            userId: acceptedUser.id,
            name: invite.name || acceptedUser.name,
            role: "Profissional",
            email: invite.email,
            phone: invite.phone || "",
            isActive: true
          },
          select: { id: true }
        });
        professionalId = professional.id;
      }

      await tx.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: acceptedUser.id,
          role: invite.role,
          permissions: invite.permissions || {},
          professionalId,
          status: "ACTIVE"
        }
      });

      const updatedUser = await tx.user.update({
        where: { id: acceptedUser.id },
        data: {
          currentWorkspaceId: invite.workspaceId,
          workspaceRole: invite.role,
          professionalId: professionalId || null,
          onboardingCompleted: true,
          onboardingCompletedAt: acceptedUser.onboardingCompletedAt || new Date()
        }
      });

      await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date()
        }
      });

      return { user: updatedUser, professionalId };
    });

    invalidateAuthUserCache(accepted.user.id);
    await recordAuditEvent({
      req,
      userId: accepted.user.id,
      email: accepted.user.email,
      eventType: "workspace.invite_accepted",
      message: "Convite de workspace aceito.",
      metadata: { workspaceId: invite.workspaceId, role: invite.role, professionalId: accepted.professionalId || "" }
    });

    const hydratedUser = await hydrateUserWorkspace(accepted.user);
    res.json({ token: signToken(accepted.user.id), user: publicUser(hydratedUser) });
  })
);

router.use(requireAuth);
router.use((req, res, next) => {
  requireWorkspaceAccess(req);
  next();
});

router.get(
  "/team-overview",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const cacheKey = teamOverviewCacheKey(req);
    const cached = getCachedTeamOverview(cacheKey);
    if (cached) return res.json(cached);

    const includeAudit = String(req.query.includeAudit || "").trim().toLowerCase() === "true";
    const auditTake = Math.min(200, Math.max(1, Number(req.query.take || 60)));
    const plan = req.plan || getPlanConfig(req.workspace?.plan);
    const canViewAudit = planHasFeature(plan, PLAN_FEATURES.AUDIT);

    const [members, professionals, logs] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { workspaceId: req.workspaceId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          professional: { select: { id: true, name: true } }
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }]
      }),
      prisma.professional.findMany({
        where: { workspaceId: req.workspaceId, isActive: true },
        orderBy: [{ name: "asc" }],
        take: 300
      }),
      includeAudit && canViewAudit
        ? prisma.auditLog.findMany({
            where: { workspaceId: req.workspaceId },
            take: auditTake,
            select: auditSelect,
            orderBy: [{ createdAt: "desc" }]
          })
        : Promise.resolve([])
    ]);

    const payload = {
      members: members.map(publicMember),
      professionals: professionals.map(publicProfessional),
      logs: logs.map(publicAuditLog),
      canViewAudit
    };
    setTeamOverviewCache(cacheKey, payload);
    res.json(payload);
  })
);

router.get(
  "/members",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        professional: { select: { id: true, name: true } }
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    });

    res.json({ members: members.map(publicMember) });
  })
);

router.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const plan = req.plan || getPlanConfig(req.workspace?.plan);
    if (!planHasFeature(plan, PLAN_FEATURES.AUDIT)) {
      throw new ApiError(403, "Auditoria de acesso esta disponivel no plano Pro.");
    }

    const pagination = parsePagination(req.query, {
      defaultPageSize: 50,
      maxPageSize: 200
    });
    const where = { workspaceId: req.workspaceId };

    if (req.query.eventType) {
      where.eventType = String(req.query.eventType);
    }

    if (req.query.memberId) {
      const member = await prisma.workspaceMember.findFirst({
        where: { id: String(req.query.memberId), workspaceId: req.workspaceId },
        select: { userId: true }
      });
      if (!member) throw new ApiError(404, "Membro nao encontrado neste workspace.");
      where.userId = member.userId;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : { take: 50 }),
      select: auditSelect,
      orderBy: [{ createdAt: "desc" }]
    });

    res.json({ logs: logs.map(publicAuditLog) });
  })
);

router.get(
  "/invites",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    await expireOldInvites(req.workspaceId);

    const invites = await prisma.workspaceInvite.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        workspace: true,
        professional: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    res.json({ invites: invites.map((invite) => publicInvite(invite, req)) });
  })
);

router.post(
  "/invites",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    await expireOldInvites(req.workspaceId);

    const plan = req.plan || getPlanConfig(req.workspace?.plan);
    if (plan.slug === PLAN_SLUGS.PADRAO) {
      throw new ApiError(403, "Convites de equipe estao disponiveis nos planos Equipe e Pro.");
    }

    const email = validateEmail(req.body.email);
    const phone = normalizeInvitePhone(req.body.phone);
    const name = optionalString(req.body.name);
    const role = normalizeInviteRole(req.body.role);
    const professionalId = optionalString(req.body.professionalId);
    const permissions = normalizePermissions(plan, req.body.permissions);

    if (professionalId) {
      await assertProfessionalBelongsToWorkspace(professionalId, req.workspaceId);
    }

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: req.workspaceId,
            userId: existingUser.id
          }
        },
        select: { id: true }
      });
      if (existingMember) {
        throw new ApiError(409, "Este usuario ja faz parte deste workspace.");
      }
    }

    const existingPendingInvite = await prisma.workspaceInvite.findFirst({
      where: {
        workspaceId: req.workspaceId,
        email,
        status: "PENDING",
        expiresAt: { gt: new Date() }
      },
      select: { id: true }
    });
    if (existingPendingInvite) {
      throw new ApiError(409, "Ja existe um convite pendente para este email.");
    }

    await assertWorkspaceCapacity({
      workspaceId: req.workspaceId,
      plan,
      role,
      addsUser: true,
      needsNewProfessional: role === "PROFESSIONAL" && !professionalId
    });

    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId: req.workspaceId,
        email,
        phone,
        name: name || null,
        role,
        permissions,
        professionalId: professionalId || null,
        token: randomBytes(32).toString("hex"),
        invitedById: req.user.id,
        expiresAt: expiresAtFromNow()
      },
      include: {
        workspace: true,
        professional: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } }
      }
    });

    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "workspace.invite_created",
      message: "Convite de workspace criado.",
      metadata: { workspaceId: req.workspaceId, inviteId: invite.id, email, role, professionalId: professionalId || "" }
    });

    res.status(201).json({ invite: publicInvite(invite, req) });
  })
);

router.patch(
  "/invites/:id/cancel",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const invite = await prisma.workspaceInvite.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      include: {
        workspace: true,
        professional: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } }
      }
    });

    if (!invite) throw new ApiError(404, "Convite nao encontrado neste workspace.");
    if (invite.status !== "PENDING") {
      throw new ApiError(409, "Somente convites pendentes podem ser cancelados.");
    }

    const canceled = await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { status: "CANCELED" },
      include: {
        workspace: true,
        professional: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } }
      }
    });

    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "workspace.invite_canceled",
      message: "Convite de workspace cancelado.",
      metadata: { workspaceId: req.workspaceId, inviteId: invite.id, email: invite.email }
    });

    res.json({ invite: publicInvite(canceled, req) });
  })
);

router.delete(
  "/invites/:id",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const invite = await prisma.workspaceInvite.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      include: {
        workspace: true,
        professional: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } }
      }
    });

    if (!invite) throw new ApiError(404, "Convite nao encontrado neste workspace.");
    if (invite.status !== "PENDING") {
      throw new ApiError(409, "Somente convites pendentes podem ser cancelados.");
    }

    const canceled = await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { status: "CANCELED" },
      include: {
        workspace: true,
        professional: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } }
      }
    });

    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "workspace.invite_canceled",
      message: "Convite de workspace cancelado.",
      metadata: { workspaceId: req.workspaceId, inviteId: invite.id, email: invite.email }
    });

    res.json({ invite: publicInvite(canceled, req) });
  })
);

router.patch(
  "/members/:id",
  asyncHandler(async (req, res) => {
    requireWorkspaceOwner(req);
    const current = await findMemberOrFail(req.workspaceId, req.params.id);
    assertCanManageTargetMember(req, current, { ownerOnly: true });

    const role = req.body.role === undefined ? current.role : normalizeRole(req.body.role);
    const status = req.body.status === undefined ? current.status : normalizeMemberStatus(req.body.status, current.status);
    const professionalId =
      req.body.professionalId === undefined
        ? current.professionalId || ""
        : optionalString(req.body.professionalId);
    const permissions =
      req.body.permissions === undefined
        ? current.permissions || {}
        : normalizePermissions(req.plan || getPlanConfig(req.workspace?.plan), req.body.permissions);

    if (professionalId) {
      await assertProfessionalBelongsToWorkspace(professionalId, req.workspaceId);
    }
    if (role === "PROFESSIONAL" && !professionalId) {
      throw new ApiError(400, "Profissionais precisam estar vinculados a um profissional.");
    }

    await assertWorkspaceCapacity({
      workspaceId: req.workspaceId,
      plan: req.plan || getPlanConfig(req.workspace?.plan),
      role,
      addsUser: current.status !== "ACTIVE" && status === "ACTIVE",
      excludeMemberId: current.id
    });

    const member = await prisma.workspaceMember.update({
      where: { id: current.id },
      data: {
        role,
        status,
        permissions,
        professionalId: professionalId || null
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        professional: { select: { id: true, name: true } }
      }
    });

    await prisma.user.updateMany({
      where: { id: member.userId, currentWorkspaceId: req.workspaceId },
      data: { workspaceRole: member.role, professionalId: member.professionalId || null }
    });
    clearTeamOverviewCache();
    invalidateAuthUserCache(member.userId);

    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "workspace.member_updated",
      message: "Membro de workspace atualizado.",
      metadata: { workspaceId: req.workspaceId, memberId: member.id, role, status }
    });

    res.json({ member: publicMember(member) });
  })
);

router.patch(
  "/members/:id/disable",
  asyncHandler(async (req, res) => {
    const current = await findMemberOrFail(req.workspaceId, req.params.id);
    assertCanManageTargetMember(req, current);

    const member = await prisma.workspaceMember.update({
      where: { id: current.id },
      data: { status: "DISABLED" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        professional: { select: { id: true, name: true } }
      }
    });

    await prisma.user.updateMany({
      where: { id: member.userId, currentWorkspaceId: req.workspaceId },
      data: { currentWorkspaceId: null }
    });
    clearTeamOverviewCache();
    invalidateAuthUserCache(member.userId);

    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "workspace.member_disabled",
      message: "Membro de workspace desativado.",
      metadata: { workspaceId: req.workspaceId, memberId: member.id }
    });

    res.json({ member: publicMember(member) });
  })
);

router.patch(
  "/members/:id/enable",
  asyncHandler(async (req, res) => {
    const current = await findMemberOrFail(req.workspaceId, req.params.id);
    assertCanManageTargetMember(req, current);

    await assertWorkspaceCapacity({
      workspaceId: req.workspaceId,
      plan: req.plan || getPlanConfig(req.workspace?.plan),
      role: current.role,
      addsUser: current.status !== "ACTIVE",
      excludeMemberId: current.id
    });

    const member = await prisma.workspaceMember.update({
      where: { id: current.id },
      data: { status: "ACTIVE" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        professional: { select: { id: true, name: true } }
      }
    });

    await prisma.user.updateMany({
      where: { id: member.userId },
      data: {
        currentWorkspaceId: req.workspaceId,
        workspaceRole: member.role,
        professionalId: member.professionalId || null
      }
    });
    clearTeamOverviewCache();
    invalidateAuthUserCache(member.userId);

    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "workspace.member_enabled",
      message: "Membro de workspace reativado.",
      metadata: { workspaceId: req.workspaceId, memberId: member.id }
    });

    res.json({ member: publicMember(member) });
  })
);

router.delete(
  "/members/:id",
  asyncHandler(async (req, res) => {
    requireWorkspaceOwner(req);
    const current = await findMemberOrFail(req.workspaceId, req.params.id);
    assertCanManageTargetMember(req, current, { ownerOnly: true });

    await prisma.workspaceMember.delete({ where: { id: current.id } });
    await prisma.user.updateMany({
      where: { id: current.userId, currentWorkspaceId: req.workspaceId },
      data: { currentWorkspaceId: null }
    });
    clearTeamOverviewCache();
    invalidateAuthUserCache(current.userId);

    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "workspace.member_removed",
      message: "Membro de workspace removido.",
      metadata: { workspaceId: req.workspaceId, memberId: current.id }
    });

    res.status(204).send();
  })
);

export default router;
