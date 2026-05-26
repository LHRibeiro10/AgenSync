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

export async function resolveWorkspaceContext(user, options = {}) {
  if (!user || isPlatformAccount(user)) {
    return { workspace: null, member: null, legacy: false };
  }

  const requestedWorkspaceId = String(options.workspaceId || "").trim();

  try {
    const where = {
      userId: user.id,
      status: "ACTIVE",
      ...(requestedWorkspaceId ? { workspaceId: requestedWorkspaceId } : {})
    };

    const preferredMember = user.currentWorkspaceId && !requestedWorkspaceId
      ? await prisma.workspaceMember.findFirst({
          where: { userId: user.id, workspaceId: user.currentWorkspaceId, status: "ACTIVE" },
          select: memberSelect
        })
      : null;

    const member =
      preferredMember ||
      (await prisma.workspaceMember.findFirst({
        where,
        select: memberSelect,
        orderBy: [{ role: "asc" }, { createdAt: "asc" }]
      }));

    if (requestedWorkspaceId && !member) {
      throw new ApiError(403, "Voce nao faz parte deste workspace.");
    }

    if (member?.workspace) {
      return { workspace: member.workspace, member, legacy: false };
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
    const existingMember = await client.workspaceMember.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      select: { workspaceId: true },
      orderBy: [{ createdAt: "asc" }]
    });

    if (existingMember?.workspaceId) {
      if (user.currentWorkspaceId !== existingMember.workspaceId) {
        await backfillWorkspaceIdForUser(client, user.id, existingMember.workspaceId);
        await client.user.update({
          where: { id: user.id },
          data: { currentWorkspaceId: existingMember.workspaceId }
        });
        return { ...user, currentWorkspaceId: existingMember.workspaceId };
      }
      return user;
    }

    const professional = user.professionalId
      ? await client.professional.findFirst({
          where: { id: user.professionalId, userId: user.id },
          select: { id: true }
        })
      : null;

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
