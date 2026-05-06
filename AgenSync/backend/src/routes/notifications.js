import { Router } from "express";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { prisma } from "../prisma.js";
import { publicNotification } from "../services/notificationService.js";

const router = Router();

function limitFromQuery(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(Math.floor(parsed), 1), 50);
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: [{ createdAt: "desc" }],
      take: limitFromQuery(req.query.limit)
    });

    res.json({
      notifications: notifications.map(publicNotification),
      unreadCount: notifications.filter((notification) => !notification.readAt).length
    });
  })
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() }
    });

    res.json({ ok: true });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!notification) throw new ApiError(404, "Notificacao nao encontrada.");

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt || new Date() }
    });

    res.json({ notification: publicNotification(updated) });
  })
);

export default router;
