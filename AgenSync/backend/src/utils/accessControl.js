import { PLAN_FEATURES, getCurrentPlan, planHasFeature } from "../config/plans.js";
import { ApiError } from "../middleware/error.js";

export const WORKSPACE_ROLES = Object.freeze({
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  PROFESSIONAL: "PROFESSIONAL"
});

export function getWorkspaceRole(user) {
  return String(user?.workspaceRole || WORKSPACE_ROLES.OWNER).trim().toUpperCase();
}

export function isWorkspaceProfessional(user) {
  return getWorkspaceRole(user) === WORKSPACE_ROLES.PROFESSIONAL;
}

export function isWorkspaceManager(user) {
  const role = getWorkspaceRole(user);
  return role === WORKSPACE_ROLES.OWNER || role === WORKSPACE_ROLES.ADMIN;
}

export function isPlatformOwner(user) {
  const role = String(user?.platformRole || "").trim().toUpperCase();
  return role === "DEVELOPER" || role === "PLATFORM_OWNER";
}

export function canManageWorkspace(user) {
  return isPlatformOwner(user) || isWorkspaceManager(user);
}

export function requireWorkspaceManager(req) {
  if (!canManageWorkspace(req.user)) {
    throw new ApiError(403, "Acesso restrito ao responsavel pela conta.");
  }
}

export function requireWorkspaceOwner(req) {
  if (isPlatformOwner(req.user)) return;
  if (getWorkspaceRole(req.user) !== WORKSPACE_ROLES.OWNER) {
    throw new ApiError(403, "Acesso restrito ao dono da conta.");
  }
}

export function requirePlanFeature(req, featureKey, message = "Recurso indisponivel no plano atual.") {
  if (isPlatformOwner(req.user)) return;
  if (!planHasFeature(req.user, featureKey)) {
    throw new ApiError(403, message);
  }
}

export async function assertProfessionalBelongsToUser(prisma, userId, professionalId, message = "Profissional invalido para esta conta.") {
  if (!professionalId) return null;

  const professional = await prisma.professional.findFirst({
    where: { id: String(professionalId), userId },
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

    await assertProfessionalBelongsToUser(prisma, user.id, user.professionalId);
    return {
      professionalId: user.professionalId,
      restricted: true
    };
  }

  const professionalId = requestedProfessionalId ? String(requestedProfessionalId) : "";
  if (!professionalId) {
    return { professionalId: "", restricted: false };
  }

  await assertProfessionalBelongsToUser(prisma, user.id, professionalId);
  return { professionalId, restricted: false };
}

export function professionalWhere(scope) {
  return scope?.professionalId ? { professionalId: scope.professionalId } : {};
}

export async function assertCanCreateProfessional(prisma, user, { excludeProfessionalId = "", active = true } = {}) {
  if (isPlatformOwner(user) || !active) return;

  const plan = getCurrentPlan(user);
  const activeProfessionals = await prisma.professional.count({
    where: {
      userId: user.id,
      isActive: true,
      ...(excludeProfessionalId ? { id: { not: excludeProfessionalId } } : {})
    }
  });

  if (activeProfessionals >= plan.maxProfessionals) {
    throw new ApiError(409, `Seu plano atual permite ate ${plan.maxProfessionals} profissional(is).`);
  }
}

export async function assertPlanCanUseMultipleProfessionals(prisma, user) {
  if (isPlatformOwner(user)) return;

  const plan = getCurrentPlan(user);
  if (!planHasFeature(user, PLAN_FEATURES.MULTIPLE_PROFESSIONALS)) {
    const activeProfessionals = await prisma.professional.count({
      where: { userId: user.id, isActive: true }
    });
    if (activeProfessionals > 1) {
      throw new ApiError(403, `Seu plano atual permite ate ${plan.maxProfessionals} profissional(is).`);
    }
  }
}
