import { Router } from "express";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { invalidateAuthUserCache } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { rescheduleFutureAppointmentRemindersForUser } from "../services/appointmentReminderService.js";
import { createInternalNotification, publicNotification } from "../services/notificationService.js";

const router = Router();

const NOTIFICATION_OFFSETS = new Set([10, 15, 30, 60, 120, 1440]);
const DEFAULT_CHANNELS = ["internal", "push"];

const DEFAULT_WHATSAPP_REMINDER_MESSAGE =
  "Olá, {cliente}! Passando para lembrar do seu atendimento de {servico} no dia {data} às {hora}.";
const DEFAULT_WHATSAPP_CONFIRMATION_MESSAGE =
  "Olá, {cliente}! Tudo certo para o seu atendimento de {servico} no dia {data} às {hora}? Pode me confirmar por aqui, por favor?";

function limitFromQuery(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(Math.floor(parsed), 1), 50);
}

function notificationSettingsFromUser(user) {
  const channels = Array.isArray(user.appointmentNotificationChannels)
    ? user.appointmentNotificationChannels
    : DEFAULT_CHANNELS;

  return {
    appointmentNotificationsEnabled: user.appointmentNotificationsEnabled !== false,
    appointmentNotificationOffsetMinutes: Number(user.appointmentNotificationOffsetMinutes || 30),
    appointmentNotificationChannels: channels.filter((channel) =>
      ["internal", "push", "email", "whatsapp"].includes(channel)
    ),
    whatsappReminderMessage: user.whatsappReminderMessage || DEFAULT_WHATSAPP_REMINDER_MESSAGE,
    whatsappConfirmationMessage: user.whatsappConfirmationMessage || DEFAULT_WHATSAPP_CONFIRMATION_MESSAGE,
    pushSupported: true
  };
}

function parseOffset(value) {
  const offset = Number(value);
  if (!Number.isInteger(offset) || !NOTIFICATION_OFFSETS.has(offset)) {
    throw new ApiError(400, "Tempo antes do agendamento invalido.");
  }
  return offset;
}

function parseChannels(value) {
  if (value === undefined) return DEFAULT_CHANNELS;
  if (!Array.isArray(value)) {
    throw new ApiError(400, "Tipos de notificacao invalidos.");
  }

  const allowed = new Set(["internal", "push", "email", "whatsapp"]);
  const channels = [...new Set(value.map((channel) => String(channel || "").trim()).filter(Boolean))];
  if (!channels.length || channels.some((channel) => !allowed.has(channel))) {
    throw new ApiError(400, "Tipos de notificacao invalidos.");
  }

  return channels;
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function parseMessage(value, fieldName) {
  if (value === undefined) return undefined;
  const message = String(value || "").trim();
  if (message.length > 1200) {
    throw new ApiError(400, `${fieldName} deve ter ate 1200 caracteres.`);
  }
  return message;
}

function safeSubscriptionPayload(value) {
  const subscription = value && typeof value === "object" ? value : {};
  const endpoint = String(subscription.endpoint || "").trim();
  if (!endpoint || !/^https?:\/\//i.test(endpoint)) {
    throw new ApiError(400, "Subscription push invalida.");
  }

  const keys = subscription.keys && typeof subscription.keys === "object" ? subscription.keys : {};
  return { endpoint, keys };
}

router.get(
  "/settings",
  asyncHandler(async (req, res) => {
    res.json({ settings: notificationSettingsFromUser(req.user) });
  })
);

router.put(
  "/settings",
  asyncHandler(async (req, res) => {
    const settings = {
      appointmentNotificationsEnabled: parseBoolean(req.body.appointmentNotificationsEnabled, true),
      appointmentNotificationOffsetMinutes: parseOffset(req.body.appointmentNotificationOffsetMinutes ?? 30),
      appointmentNotificationChannels: parseChannels(req.body.appointmentNotificationChannels),
      whatsappReminderMessage:
        parseMessage(req.body.whatsappReminderMessage, "Mensagem do lembrete") || DEFAULT_WHATSAPP_REMINDER_MESSAGE,
      whatsappConfirmationMessage:
        parseMessage(req.body.whatsappConfirmationMessage, "Mensagem de confirmacao") ||
        DEFAULT_WHATSAPP_CONFIRMATION_MESSAGE
    };

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: settings
    });

    invalidateAuthUserCache(req.user.id);
    await rescheduleFutureAppointmentRemindersForUser(req.user.id).catch(() => null);

    res.json({ settings: notificationSettingsFromUser(user) });
  })
);

router.post(
  "/push/subscribe",
  asyncHandler(async (req, res) => {
    const { endpoint, keys } = safeSubscriptionPayload(req.body.subscription || req.body);
    const userAgent = String(req.body.userAgent || req.get("user-agent") || "").slice(0, 500);

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: req.user.id,
        endpoint,
        keys,
        userAgent
      },
      update: {
        userId: req.user.id,
        keys,
        userAgent
      }
    });

    res.status(201).json({
      subscription: {
        id: subscription.id,
        endpoint: subscription.endpoint,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      }
    });
  })
);

router.delete(
  "/push/unsubscribe",
  asyncHandler(async (req, res) => {
    const endpoint = String(req.body?.endpoint || req.body?.subscription?.endpoint || "").trim();
    if (!endpoint) {
      throw new ApiError(400, "Endpoint da subscription e obrigatorio.");
    }

    await prisma.pushSubscription.deleteMany({
      where: { userId: req.user.id, endpoint }
    });

    res.status(204).send();
  })
);

router.post(
  "/test",
  asyncHandler(async (req, res) => {
    const notification = await createInternalNotification({
      userId: req.user.id,
      workspaceId: req.user.id,
      title: "Notificacao de teste do AgenSync",
      body: "As notificacoes internas estao funcionando neste navegador.",
      type: "test",
      actionUrl: "/agenda"
    });

    res.status(201).json({ notification: publicNotification(notification) });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: [{ createdAt: "desc" }],
        take: limitFromQuery(req.query.limit)
      }),
      prisma.notification.count({ where: { userId: req.user.id, readAt: null } })
    ]);

    res.json({
      notifications: notifications.map(publicNotification),
      unreadCount
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
