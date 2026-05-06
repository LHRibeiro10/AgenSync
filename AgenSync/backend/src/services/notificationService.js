import { prisma } from "../prisma.js";
import { sendPushToTokens } from "./pushService.js";

export function publicNotification(notification) {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body || "",
    type: notification.type,
    actionUrl: notification.actionUrl || "",
    readAt: notification.readAt,
    createdAt: notification.createdAt
  };
}

export async function createInternalNotification({ userId, title, body = "", type = "info", actionUrl = "" }) {
  const notification = await prisma.notification.create({
    data: { userId, title, body, type, actionUrl }
  });

  const tokens = await prisma.notificationToken.findMany({
    where: { userId, disabledAt: null },
    select: { token: true }
  });

  await sendPushToTokens(
    tokens.map((item) => item.token),
    { title, body, type, actionUrl }
  ).catch(() => null);

  return notification;
}
