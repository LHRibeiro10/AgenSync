import { prisma } from "../prisma.js";
import { sendPushToSubscriptions, sendPushToTokens } from "./pushService.js";

export function publicNotification(notification) {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body || "",
    message: notification.body || "",
    type: notification.type,
    actionUrl: notification.actionUrl || "",
    read: Boolean(notification.readAt),
    readAt: notification.readAt,
    workspaceId: notification.workspaceId || "",
    relatedEntityType: notification.relatedEntityType || "",
    relatedEntityId: notification.relatedEntityId || "",
    createdAt: notification.createdAt
  };
}

export async function createInternalNotification({
  userId,
  workspaceId = "",
  title,
  body = "",
  type = "info",
  actionUrl = "",
  relatedEntityType = "",
  relatedEntityId = "",
  push = true
}) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      workspaceId: workspaceId || userId,
      title,
      body,
      type,
      actionUrl,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null
    }
  });

  if (!push) return notification;

  const tokens = await prisma.notificationToken.findMany({
    where: { userId, disabledAt: null },
    select: { token: true }
  });
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, keys: true }
  });

  await sendPushToTokens(
    tokens.map((item) => item.token),
    { title, body, type, actionUrl }
  ).catch(() => null);

  await sendPushToSubscriptions(subscriptions, { title, body, type, actionUrl }).catch(() => null);

  return notification;
}
