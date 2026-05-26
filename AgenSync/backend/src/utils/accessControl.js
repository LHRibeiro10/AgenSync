import { PLAN_FEATURES, getCurrentPlan, getPlanConfig, planHasFeature } from "../config/plans.js";
import { ApiError } from "../middleware/error.js";

export const WORKSPACE_ROLES = Object.freeze({
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  PROFESSIONAL: "PROFESSIONAL"
});

export function getWorkspaceRole(user) {
  const source = user?.user ? user.user : user;
  return String(source?.workspaceRole || WORKSPACE_ROLES.OWNER).trim().toUpperCase();
}

export function isWorkspaceProfessional(user) {
  return getWorkspaceRole(user) === WORKSPACE_ROLES.PROFESSIONAL;
}

export function isWorkspaceManager(user) {
  const role = getWorkspaceRole(user);
  return role === WORKSPACE_ROLES.OWNER || role === WORKSPACE_ROLES.ADMIN;
}

export function isPlatformOwner(user) {
  const source = user?.user ? user.user : user;
  const role = String(source?.platformRole || "").trim().toUpperCase();
  return role === "DEVELOPER" || role === "PLATFORM_OWNER";
}

export function canManageWorkspace(user) {
  return isWorkspaceManager(user);
}

const planLimitByResource = Object.freeze({
  users: "maxUsers",
  user: "maxUsers",
  members: "maxUsers",
  member: "maxUsers",
  admins: "maxAdmins",
  admin: "maxAdmins",
  professionals: "maxProfessionals",
  professional: "maxProfessionals"
});

const planLimitLabels = Object.freeze({
  maxUsers: "usuarios",
  maxAdmins: "administradores",
  maxProfessionals: "profissionais"
});

const specialWorkspacePermissions = new Set([
  "canManageClients",
  "canManageServices",
  "canViewGeneralFinance",
  "canManageTeamSchedule",
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

function planFromContext(subject) {
  if (subject?.maxProfessionals && subject?.features) return subject;
  const source = subject?.user ? subject.user : subject;
  const workspacePlan = subject?.workspace?.plan || source?.currentWorkspace?.plan || source?.plan || source?.platformPlan;
  return getPlanConfig(workspacePlan);
}

export function canAccessFeature(subject, featureKey) {
  if (!featureKey) return true;
  return planFromContext(subject).features.includes(featureKey);
}

export function assertWithinPlanLimit(subject, resource, currentCount) {
  const limitKey = planLimitByResource[String(resource || "").trim()];
  if (!limitKey) return;

  const plan = planFromContext(subject);
  const limit = Number(plan[limitKey] || 0);
  const count = Number(currentCount || 0);
  if (!limit || count < limit) return;

  throw new ApiError(409, `Seu plano permite ate ${limit} ${planLimitLabels[limitKey] || "registros"}.`);
}

export function requireWorkspaceManager(req) {
  requireWorkspaceAccess(req);
  if (!canManageWorkspace(req.user)) {
    throw new ApiError(403, "Acesso restrito ao responsavel pela conta.");
  }
}

export function requireWorkspaceAccess(req) {
  if (!req.workspaceId || !req.workspaceMember) {
    throw new ApiError(403, "Voce nao faz parte deste workspace.");
  }
  if (String(req.workspaceMember.status || "ACTIVE").toUpperCase() !== "ACTIVE") {
    throw new ApiError(403, "Seu acesso a este workspace esta inativo.");
  }
}

export function requireWorkspaceRole(roles = []) {
  const allowed = new Set(roles.map((role) => String(role || "").trim().toUpperCase()));
  return (req, res, next) => {
    requireWorkspaceAccess(req);
    if (!allowed.has(getWorkspaceRole(req.user))) {
      throw new ApiError(403, "Voce nao tem permissao para acessar este recurso.");
    }
    next();
  };
}

export function hasWorkspacePermission(req, permission) {
  if (!permission) return true;
  const role = getWorkspaceRole(req.user);
  if (role === WORKSPACE_ROLES.OWNER || role === WORKSPACE_ROLES.ADMIN) return true;

  if (specialWorkspacePermissions.has(permission) && !canAccessFeature(req, PLAN_FEATURES.SPECIAL_PERMISSIONS)) {
    return false;
  }

  const permissions = req.workspacePermissions && typeof req.workspacePermissions === "object" ? req.workspacePermissions : {};
  return permissions[permission] === true;
}

export function hasAnyWorkspacePermission(req, permissions = []) {
  return permissions.some((permission) => hasWorkspacePermission(req, permission));
}

export function requireAnyWorkspacePermission(permissions = []) {
  return (req, res, next) => {
    requireWorkspaceAccess(req);
    if (!hasAnyWorkspacePermission(req, permissions)) {
      throw new ApiError(403, "Voce nao tem permissao para acessar este recurso.");
    }
    next();
  };
}

export function requireWorkspacePermission(permission) {
  return (req, res, next) => {
    requireWorkspaceAccess(req);
    if (!hasWorkspacePermission(req, permission)) {
      throw new ApiError(403, "Voce nao tem permissao para acessar este recurso.");
    }
    next();
  };
}

export function requireWorkspaceOwner(req) {
  requireWorkspaceAccess(req);
  if (getWorkspaceRole(req.user) !== WORKSPACE_ROLES.OWNER) {
    throw new ApiError(403, "Acesso restrito ao dono da conta.");
  }
}

export function requirePlanFeature(req, featureKey, message = "Recurso indisponivel no plano atual.") {
  if (!canAccessFeature(req, featureKey)) {
    throw new ApiError(403, message);
  }
}

export function workspaceWhere(reqOrUser, extra = {}) {
  const req = reqOrUser?.user ? reqOrUser : null;
  const user = req?.user || reqOrUser;
  const workspaceId = req?.workspaceId || user?.currentWorkspaceId || "";
  const isLegacy = req?.workspaceLegacy === true || user?.workspaceLegacy === true || String(workspaceId).startsWith("legacy_");
  const scope = workspaceId && !isLegacy ? { workspaceId } : { userId: user?.id };
  return { ...scope, ...extra };
}

export function clientAccessWhere(reqOrUser, extra = {}) {
  const req = reqOrUser?.user ? reqOrUser : null;
  const user = req?.user || reqOrUser;
  const baseScope = workspaceWhere(reqOrUser);

  if (!isWorkspaceProfessional(user)) {
    return { ...baseScope, ...extra };
  }

  const professionalId = req?.professionalId || user?.professionalId || "";
  if (!professionalId) {
    throw new ApiError(403, "Usuario profissional sem profissional vinculado.");
  }

  return {
    ...baseScope,
    ...extra,
    OR: [
      { userId: user.id },
      { appointments: { some: { ...baseScope, professionalId } } },
      { monthlyPlans: { some: { ...baseScope, professionalId } } }
    ]
  };
}

export async function assertProfessionalBelongsToUser(prisma, userOrId, professionalId, message = "Profissional invalido para esta conta.") {
  if (!professionalId) return null;
  const user = typeof userOrId === "object" ? userOrId : { id: userOrId };
  const where = workspaceWhere(user, { id: String(professionalId) });

  const professional = await prisma.professional.findFirst({
    where,
    select: { id: true, isActive: true }
  });

  if (!professional) {
    throw new ApiError(400, message);
  }

  return professional;
}

export async function resolveProfessionalScope(prisma, user, requestedProfessionalId = "") {
  if (isWorkspaceProfessional(user)) {
    if (!user?.professionalId) {
      throw new ApiError(403, "Usuario profissional sem profissional vinculado.");
    }

    await assertProfessionalBelongsToUser(prisma, user, user.professionalId);
    return {
      professionalId: user.professionalId,
      restricted: true
    };
  }

  const professionalId = requestedProfessionalId ? String(requestedProfessionalId) : "";
  if (!professionalId) {
    return { professionalId: "", restricted: false };
  }

  await assertProfessionalBelongsToUser(prisma, user, professionalId);
  return { professionalId, restricted: false };
}

export function professionalWhere(scope) {
  return scope?.professionalId ? { professionalId: scope.professionalId } : {};
}

export async function forceProfessionalScope(prisma, req, queryOrProfessionalId = "") {
  const requestedProfessionalId =
    queryOrProfessionalId && typeof queryOrProfessionalId === "object"
      ? queryOrProfessionalId.professionalId
      : queryOrProfessionalId;
  return resolveProfessionalScope(prisma, req.user, requestedProfessionalId);
}

export async function assertCanCreateProfessional(prisma, user, { excludeProfessionalId = "", active = true } = {}) {
  if (isPlatformOwner(user) || !active) return;

  const activeProfessionals = await prisma.professional.count({
    where: {
      ...workspaceWhere(user),
      isActive: true,
      ...(excludeProfessionalId ? { id: { not: excludeProfessionalId } } : {})
    }
  });

  assertWithinPlanLimit(user, "professionals", activeProfessionals);
}

export async function assertPlanCanUseMultipleProfessionals(prisma, user) {
  if (isPlatformOwner(user)) return;

  const plan = getCurrentPlan(user);
  if (!planHasFeature(user, PLAN_FEATURES.MULTIPLE_PROFESSIONALS)) {
    const activeProfessionals = await prisma.professional.count({
      where: {
        ...workspaceWhere(user),
        isActive: true
      }
    });
    if (activeProfessionals > 1) {
      throw new ApiError(403, `Seu plano permite ate ${plan.maxProfessionals} profissionais.`);
    }
  }
}
