import { prisma } from "../prisma.js";
import { getPlanConfig, normalizePlanSlug, publicPlan } from "../config/plans.js";
import { ApiError } from "../middleware/error.js";

const workspaceSelect = {
  id: true,
  name: true,
  slug: true,
  ownerId: true,
  plan: true,
  planStatus: true,
  trialStartedAt: true,
  trialEndsAt: true,
  createdAt: true,
  updatedAt: true
};

const memberSelect = {
  id: true,
  workspaceId: true,
  userId: true,
  role: true,
  permissions: true,
  professionalId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  workspace: { select: workspaceSelect }
};

const workspaceRoleRank = {
  OWNER: 0,
  ADMIN: 1,
  PROFESSIONAL: 2
};

export function isPlatformAccount(user) {
  const role = String(user?.platformRole || "").trim().toUpperCase();
  return role === "DEVELOPER" || role === "PLATFORM_OWNER";
}

function isMissingWorkspaceSchemaError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return code === "P2021" || code === "P2022" || /Workspace(Member)?|currentWorkspaceId|workspaceId/i.test(message);
}

function legacyWorkspaceFromUser(user) {
  if (!user?.id) return null;
  return {
    id: user.currentWorkspaceId || `legacy_${user.id}`,
    name: user.businessName || user.name || "Meu negocio",
    slug: null,
    ownerId: user.id,
    plan: normalizePlanSlug(user.platformPlan),
    planStatus: user.subscriptionStatus || "PAID",
    trialStartedAt: null,
    trialEndsAt: null,
    createdAt: user.createdAt || new Date(),
    updatedAt: user.updatedAt || user.createdAt || new Date()
  };
}

function legacyMemberFromUser(user, workspace) {
  if (!user?.id || !workspace?.id) return null;
  return {
    id: `legacy_member_${user.id}`,
    workspaceId: workspace.id,
    userId: user.id,
    role: user.workspaceRole || "OWNER",
    permissions: {},
    professionalId: user.professionalId || null,
    status: "ACTIVE",
    createdAt: user.createdAt || new Date(),
    updatedAt: user.updatedAt || user.createdAt || new Date(),
    workspace
  };
}

async function backfillWorkspaceIdForUser(client, userId, workspaceId) {
  if (!userId || !workspaceId) return;

  await Promise.all([
    client.professional.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId } }),
    client.client.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId } }),
    client.service.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId } }),
    client.appointment.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId } }),
    client.expense.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId } }),
    client.product.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId } }),
    client.productSale.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId } }),
    client.monthlyPlan.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId } }),
    client.notification.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId } }),
    client.clientCareRecord.updateMany({
      where: { workspaceId: null, client: { userId } },
      data: { workspaceId }
    })
  ]);
}

export function publicWorkspace(workspace) {
  if (!workspace) return null;
  const plan = publicPlan({ platformPlan: workspace.plan });
  const exceededResources = Array.isArray(workspace.exceededResources) ? workspace.exceededResources : [];
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug || "",
    ownerId: workspace.ownerId,
    plan: normalizePlanSlug(workspace.plan),
    planStatus: String(workspace.planStatus || "PAID").toLowerCase(),
    trialStartedAt: workspace.trialStartedAt || null,
    trialEndsAt: workspace.trialEndsAt || null,
    planLimits: {
      maxUsers: plan.maxUsers,
      maxProfessionals: plan.maxProfessionals,
      maxAdmins: plan.maxAdmins
    },
    planFeatures: plan.features,
    planLimitExceeded: Boolean(workspace.planLimitExceeded || exceededResources.length),
    exceededResources,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt
  };
}

export function publicWorkspaceMember(member) {
  if (!member) return null;
  return {
    id: member.id,
    workspaceId: member.workspaceId,
    userId: member.userId,
    role: String(member.role || "PROFESSIONAL").toLowerCase(),
    permissions: member.permissions && typeof member.permissions === "object" ? member.permissions : {},
    professionalId: member.professionalId || "",
    status: String(member.status || "ACTIVE").toLowerCase(),
    createdAt: member.createdAt,
    updatedAt: member.updatedAt
  };
}

function inactiveWorkspaceAccessError() {
  return new ApiError(403, "Seu acesso a este workspace esta inativo.");
}

function workspaceMemberLimitError(state) {
  return new ApiError(
    403,
    "Seu acesso a esta conta esta bloqueado pelo limite de usuarios do plano. Peca ao responsavel para regularizar o plano ou os membros ativos.",
    {
      code: "WORKSPACE_MEMBER_LIMIT_EXCEEDED",
      plan: state?.plan || "",
      exceededResources: state?.exceededResources || []
    }
  );
}

function compareMembersForPlanAccess(ownerId) {
  return (first, second) => {
    const firstRole = String(first.role || "PROFESSIONAL").toUpperCase();
    const secondRole = String(second.role || "PROFESSIONAL").toUpperCase();
    const firstRank = first.userId === ownerId ? 0 : workspaceRoleRank[firstRole] ?? 3;
    const secondRank = second.userId === ownerId ? 0 : workspaceRoleRank[secondRole] ?? 3;
    if (firstRank !== secondRank) return firstRank - secondRank;

    const firstDate = new Date(first.createdAt || 0).getTime();
    const secondDate = new Date(second.createdAt || 0).getTime();
    if (firstDate !== secondDate) return firstDate - secondDate;

    return String(first.id || "").localeCompare(String(second.id || ""));
  };
}

function exceededResource(resource, current, limit) {
  const safeCurrent = Number(current || 0);
  const safeLimit = Number(limit || 0);
  if (safeLimit < 0 || safeCurrent <= safeLimit) return null;
  return { resource, current: safeCurrent, limit: safeLimit };
}

async function loadWorkspacePlanLimitState(client, workspace) {
  if (!workspace?.id) {
    return {
      plan: "",
      ownerId: "",
      userLimitExceeded: false,
      allowedMemberIds: new Set(),
      planLimitExceeded: false,
      exceededResources: []
    };
  }

  const plan = getPlanConfig(workspace.plan);
  const [activeMembers, activeProfessionals] = await Promise.all([
    client.workspaceMember.findMany({
      where: { workspaceId: workspace.id, status: "ACTIVE" },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true
      }
    }),
    client.professional.count({
      where: { workspaceId: workspace.id, isActive: true }
    })
  ]);

  const activeAdmins = activeMembers.filter((member) => String(member.role || "").toUpperCase() === "ADMIN").length;
  const exceededResources = [
    exceededResource("users", activeMembers.length, plan.maxUsers),
    exceededResource("admins", activeAdmins, plan.maxAdmins),
    exceededResource("professionals", activeProfessionals, plan.maxProfessionals)
  ].filter(Boolean);

  const sortedMembers = activeMembers.slice().sort(compareMembersForPlanAccess(workspace.ownerId));
  const allowedMemberIds = new Set();
  sortedMembers.forEach((member) => {
    if (member.userId === workspace.ownerId) allowedMemberIds.add(member.id);
  });
  sortedMembers.forEach((member) => {
    if (allowedMemberIds.has(member.id)) return;
    if (allowedMemberIds.size >= Number(plan.maxUsers || 0)) return;
    allowedMemberIds.add(member.id);
  });

  return {
    plan: plan.slug,
    ownerId: workspace.ownerId,
    userLimitExceeded: activeMembers.length > Number(plan.maxUsers || 0),
    allowedMemberIds,
    planLimitExceeded: exceededResources.length > 0,
    exceededResources
  };
}

function workspaceWithLimitState(workspace, state) {
  if (!workspace) return null;
  return {
    ...workspace,
    planLimitExceeded: Boolean(state?.planLimitExceeded),
    exceededResources: state?.exceededResources || []
  };
}

function memberIsAllowedByUserLimit(member, state) {
  if (!member) return false;
  if (!state?.userLimitExceeded) return true;
  if (member.userId === state.ownerId) return true;
  return state.allowedMemberIds?.has(member.id) === true;
}

async function contextForActiveMember(client, member) {
  if (!member?.workspace) return null;
  const state = await loadWorkspacePlanLimitState(client, member.workspace);
  if (!memberIsAllowedByUserLimit(member, state)) {
    throw workspaceMemberLimitError(state);
  }
  return {
    workspace: workspaceWithLimitState(member.workspace, state),
    member,
    legacy: false
  };
}

async function findFirstEligibleActiveMember(client, userId) {
  const members = await client.workspaceMember.findMany({
    where: { userId, status: "ACTIVE" },
    select: memberSelect,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });

  let firstBlockedState = null;
  for (const member of members) {
    const state = await loadWorkspacePlanLimitState(client, member.workspace);
    if (memberIsAllowedByUserLimit(member, state)) {
      return {
        workspace: workspaceWithLimitState(member.workspace, state),
        member,
        legacy: false
      };
    }
    firstBlockedState ||= state;
  }

  if (firstBlockedState) {
    throw workspaceMemberLimitError(firstBlockedState);
  }

  return null;
}

export async function resolveWorkspaceContext(user, options = {}) {
  if (!user || isPlatformAccount(user)) {
    return { workspace: null, member: null, legacy: false };
  }

  const requestedWorkspaceId = String(options.workspaceId || "").trim();

  try {
    const scopedWorkspaceId = requestedWorkspaceId || user.currentWorkspaceId || "";
    if (scopedWorkspaceId) {
      const scopedMember = await prisma.workspaceMember.findFirst({
        where: { userId: user.id, workspaceId: scopedWorkspaceId },
        select: memberSelect
      });

      if (scopedMember) {
        if (String(scopedMember.status || "").toUpperCase() !== "ACTIVE") {
          throw inactiveWorkspaceAccessError();
        }
        return await contextForActiveMember(prisma, scopedMember);
      }

      if (requestedWorkspaceId) {
        throw new ApiError(403, "Voce nao faz parte deste workspace.");
      }
    }

    const eligibleContext = await findFirstEligibleActiveMember(prisma, user.id);
    if (eligibleContext) return eligibleContext;

    const inactiveMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { status: true }
    });
    if (inactiveMember) {
      throw inactiveWorkspaceAccessError();
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (!isMissingWorkspaceSchemaError(error)) throw error;
  }

  const workspace = legacyWorkspaceFromUser(user);
  return {
    workspace,
    member: legacyMemberFromUser(user, workspace),
    legacy: true
  };
}

export async function ensureDefaultWorkspaceForUser(user, client = prisma) {
  if (!user || isPlatformAccount(user)) return user;

  try {
    if (user.currentWorkspaceId) {
      const currentMember = await client.workspaceMember.findFirst({
        where: { userId: user.id, workspaceId: user.currentWorkspaceId },
        select: { id: true, status: true }
      });
      if (currentMember) return user;
    }

    const existingContext = await findFirstEligibleActiveMember(client, user.id);

    if (existingContext?.workspace?.id) {
      if (user.currentWorkspaceId !== existingContext.workspace.id) {
        await backfillWorkspaceIdForUser(client, user.id, existingContext.workspace.id);
        await client.user.update({
          where: { id: user.id },
          data: { currentWorkspaceId: existingContext.workspace.id }
        });
        return { ...user, currentWorkspaceId: existingContext.workspace.id };
      }
      return user;
    }

    const inactiveMember = await client.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { id: true }
    });

    if (inactiveMember) {
      return user;
    }

    const professional = user.professionalId
      ? await client.professional.findFirst({
          where: { id: user.professionalId, userId: user.id },
          select: { id: true }
        })
      : null;

    const ownedWorkspace = await client.workspace.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }]
    });

    if (ownedWorkspace?.id) {
      await client.workspaceMember
        .create({
          data: {
            workspaceId: ownedWorkspace.id,
            userId: user.id,
            role: "OWNER",
            permissions: {},
            professionalId: professional?.id || null,
            status: "ACTIVE"
          }
        })
        .catch((error) => {
          if (String(error?.code || "") !== "P2002") throw error;
        });

      await client.user.update({
        where: { id: user.id },
        data: { currentWorkspaceId: ownedWorkspace.id }
      });
      await backfillWorkspaceIdForUser(client, user.id, ownedWorkspace.id);

      return { ...user, currentWorkspaceId: ownedWorkspace.id };
    }

    const workspace = await client.workspace.create({
      data: {
        name: user.businessName || user.name || "Meu negocio",
        ownerId: user.id,
        plan: normalizePlanSlug(user.platformPlan),
        planStatus: user.subscriptionStatus || "PAID"
      },
      select: { id: true }
    });

    await client.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: user.workspaceRole || "OWNER",
        permissions: {},
        professionalId: professional?.id || null,
        status: "ACTIVE"
      }
    });

    await client.user.update({
      where: { id: user.id },
      data: { currentWorkspaceId: workspace.id }
    });
    await backfillWorkspaceIdForUser(client, user.id, workspace.id);

    return { ...user, currentWorkspaceId: workspace.id };
  } catch (error) {
    if (isMissingWorkspaceSchemaError(error)) return user;
    if (String(error?.code || "") === "P2002") return user;
    throw error;
  }
}

export async function hydrateUserWorkspace(user) {
  const ensuredUser = await ensureDefaultWorkspaceForUser(user);
  const context = await resolveWorkspaceContext(ensuredUser);
  if (!context.workspace || !context.member) return ensuredUser;

  return {
    ...ensuredUser,
    currentWorkspaceId: context.workspace.id,
    workspaceRole: context.member.role,
    professionalId: context.member.professionalId || ensuredUser.professionalId || "",
    platformPlan: normalizePlanSlug(context.workspace.plan || ensuredUser.platformPlan),
    currentWorkspace: publicWorkspace(context.workspace),
    workspaceMember: publicWorkspaceMember(context.member)
  };
}

export async function attachWorkspaceContext(req) {
  const requestedWorkspaceId =
    req.get?.("x-workspace-id") ||
    req.query?.workspaceId ||
    req.body?.workspaceId ||
    "";

  const context = await resolveWorkspaceContext(req.user, { workspaceId: requestedWorkspaceId });
  req.workspace = context.workspace;
  req.currentWorkspace = context.workspace;
  req.workspaceId = context.workspace?.id || "";
  req.workspaceLegacy = context.legacy === true;
  req.workspaceMember = context.member;
  req.workspaceRole = context.member?.role || req.user?.workspaceRole || "";
  req.workspacePermissions = context.member?.permissions || {};
  req.professionalId = context.member?.professionalId || req.user?.professionalId || "";
  req.plan = context.workspace ? getPlanConfig(context.workspace.plan) : null;

  if (req.user && context.workspace && context.member) {
    req.user.currentWorkspaceId = context.workspace.id;
    req.user.workspaceLegacy = context.legacy === true;
    req.user.workspaceRole = context.member.role;
    req.user.professionalId = context.member.professionalId || req.user.professionalId || "";
    req.user.platformPlan = normalizePlanSlug(context.workspace.plan || req.user.platformPlan);
    req.user.plan = normalizePlanSlug(context.workspace.plan || req.user.platformPlan);
    req.user.currentWorkspace = publicWorkspace(context.workspace);
    req.user.workspaceMember = publicWorkspaceMember(context.member);
  }

  return context;
}
