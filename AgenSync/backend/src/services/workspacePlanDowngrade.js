import { PLAN_SLUGS } from "../config/plans.js";

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function updateOwnedData(client, modelName, workspaceIds, affiliateUserIds, ownerId) {
  if (!workspaceIds.length || !affiliateUserIds.length) return 0;
  const result = await client[modelName].updateMany({
    where: {
      workspaceId: { in: workspaceIds },
      userId: { in: affiliateUserIds }
    },
    data: { userId: ownerId }
  });
  return result.count || 0;
}

export async function consolidateOwnerWorkspaceForStandardPlan(client, ownerId) {
  const ownedWorkspaces = await client.workspace.findMany({
    where: { ownerId },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }]
  });
  const workspaceIds = ownedWorkspaces.map((workspace) => workspace.id);

  if (!workspaceIds.length) {
    await client.user.update({
      where: { id: ownerId },
      data: {
        platformPlan: PLAN_SLUGS.PADRAO,
        workspaceRole: "OWNER",
        currentWorkspaceId: null
      }
    });

    return {
      primaryWorkspaceId: "",
      affiliateUserIds: [],
      disabledMembers: 0,
      canceledInvites: 0,
      transferredRecords: 0
    };
  }

  const primaryWorkspaceId = workspaceIds[0];
  const affiliateMembers = await client.workspaceMember.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      userId: { not: ownerId }
    },
    select: { userId: true }
  });
  const affiliateUserIds = unique(affiliateMembers.map((member) => member.userId));

  let transferredRecords = 0;
  for (const modelName of [
    "client",
    "professional",
    "service",
    "appointment",
    "expense",
    "product",
    "productSale",
    "monthlyPlan",
    "notification"
  ]) {
    transferredRecords += await updateOwnedData(client, modelName, workspaceIds, affiliateUserIds, ownerId);
  }

  if (affiliateUserIds.length) {
    const reminderResult = await client.appointmentReminder.updateMany({
      where: {
        userId: { in: affiliateUserIds },
        appointment: {
          workspaceId: { in: workspaceIds }
        }
      },
      data: { userId: ownerId }
    });
    transferredRecords += reminderResult.count || 0;
  }

  const disabledMembersResult = await client.workspaceMember.updateMany({
    where: {
      workspaceId: { in: workspaceIds },
      userId: { not: ownerId },
      status: { not: "DISABLED" }
    },
    data: { status: "DISABLED" }
  });

  const canceledInvitesResult = await client.workspaceInvite.updateMany({
    where: {
      workspaceId: { in: workspaceIds },
      status: "PENDING"
    },
    data: { status: "CANCELED" }
  });

  await client.workspace.updateMany({
    where: { id: { in: workspaceIds } },
    data: {
      plan: PLAN_SLUGS.PADRAO,
      planStatus: "PAID"
    }
  });

  await client.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: primaryWorkspaceId,
        userId: ownerId
      }
    },
    update: {
      role: "OWNER",
      status: "ACTIVE",
      permissions: {}
    },
    create: {
      workspaceId: primaryWorkspaceId,
      userId: ownerId,
      role: "OWNER",
      status: "ACTIVE",
      permissions: {}
    }
  });

  await client.user.update({
    where: { id: ownerId },
    data: {
      platformPlan: PLAN_SLUGS.PADRAO,
      workspaceRole: "OWNER",
      currentWorkspaceId: primaryWorkspaceId
    }
  });

  if (affiliateUserIds.length) {
    await client.user.updateMany({
      where: { id: { in: affiliateUserIds } },
      data: {
        currentWorkspaceId: null,
        workspaceRole: "OWNER",
        professionalId: null,
        accountStatus: "INACTIVE",
        userStatus: "INACTIVE",
        billingEnabled: false
      }
    });
  }

  return {
    primaryWorkspaceId,
    affiliateUserIds,
    disabledMembers: disabledMembersResult.count || 0,
    canceledInvites: canceledInvitesResult.count || 0,
    transferredRecords
  };
}
