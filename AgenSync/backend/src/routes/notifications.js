import { Router } from "express";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { invalidateAuthUserCache } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { rescheduleFutureAppointmentRemindersForUser } from "../services/appointmentReminderService.js";
import { createInternalNotification, publicNotification } from "../services/notificationService.js";
import { requireWorkspaceManager } from "../utils/accessControl.js";

const router = Router();

const NOTIFICATION_OFFSETS = new Set([10, 15, 30, 60, 120, 1440]);
const DEFAULT_CHANNELS = ["internal", "push"];
const NOTIFICATIONS_CACHE_TTL_MS = Math.max(5_000, Number(process.env.NOTIFICATIONS_CACHE_TTL_MS || 20_000));
const NOTIFICATIONS_CACHE_MAX_ITEMS = Math.max(100, Number(process.env.NOTIFICATIONS_CACHE_MAX_ITEMS || 300));
const notificationsCache = new Map();
const notificationsInflight = new Map();

const DEFAULT_WHATSAPP_REMINDER_MESSAGE =
  "Olá, {cliente}! Passando para lembrar do seu atendimento de {servico} no dia {data} às {hora}.";
const DEFAULT_WHATSAPP_CONFIRMATION_MESSAGE =
  "Olá, {cliente}! Tudo certo para o seu atendimento de {servico} no dia {data} às {hora}? Pode me confirmar por aqui, por favor?";

function limitFromQuery(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(Math.floor(parsed), 1), 50);
}

function notificationWhere(req, extra = {}) {
  const workspaceIds = [req.workspaceId || ""].filter(Boolean);
  if (req.workspaceLegacy || !workspaceIds.length) workspaceIds.push(req.user.id);

  return {
    userId: req.user.id,
    ...extra,
    OR: [
      ...(workspaceIds.length ? [{ workspaceId: { in: [...new Set(workspaceIds)] } }] : []),
      { workspaceId: null }
    ]
  };
}

function notificationsCacheKey(req) {
  return JSON.stringify({
    userId: req.user?.id || "",
    workspaceId: req.workspaceId || "",
    legacy: Boolean(req.workspaceLegacy),
    limit: limitFromQuery(req.query.limit)
  });
}

function getCachedNotifications(key) {
  const cached = notificationsCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    notificationsCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedNotifications(key, value) {
  if (notificationsCache.size >= NOTIFICATIONS_CACHE_MAX_ITEMS) {
    const oldestKey = notificationsCache.keys().next().value;
    if (oldestKey) notificationsCache.delete(oldestKey);
  }
  notificationsCache.set(key, {
    value,
    expiresAt: Date.now() + NOTIFICATIONS_CACHE_TTL_MS
  });
}

function clearNotificationsCacheForUser(userId = "") {
  if (!userId) {
    notificationsCache.clear();
    return;
  }
  for (const key of notificationsCache.keys()) {
    if (key.includes(`"userId":"${userId}"`)) notificationsCache.delete(key);
  }
  for (const key of notificationsInflight.keys()) {
    if (key.includes(`"userId":"${userId}"`)) notificationsInflight.delete(key);
  }
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
    requireWorkspaceManager(req);
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
      workspaceId: req.workspaceId || null,
      title: "Notificacao de teste do AgenSync",
      body: "As notificacoes internas estao funcionando neste navegador.",
      type: "test",
      actionUrl: "/agenda"
    });

    clearNotificationsCacheForUser(req.user.id);
    res.status(201).json({ notification: publicNotification(notification) });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const cacheKey = notificationsCacheKey(req);
    const cached = getCachedNotifications(cacheKey);
    if (cached) return res.json(cached);
    const inflight = notificationsInflight.get(cacheKey);
    if (inflight) return res.json(await inflight);

    const payloadPromise = Promise.all([
      prisma.notification.findMany({
        where: notificationWhere(req),
        orderBy: [{ createdAt: "desc" }],
        take: limitFromQuery(req.query.limit)
      }),
      prisma.notification.count({ where: notificationWhere(req, { readAt: null }) })
    ])
      .then(([notifications, unreadCount]) => ({
        notifications: notifications.map(publicNotification),
        unreadCount
      }))
      .finally(() => {
        notificationsInflight.delete(cacheKey);
      });

    notificationsInflight.set(cacheKey, payloadPromise);
    const payload = await payloadPromise;
    setCachedNotifications(cacheKey, payload);
    res.json(payload);
  })
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: notificationWhere(req, { readAt: null }),
      data: { readAt: new Date() }
    });

    clearNotificationsCacheForUser(req.user.id);
    res.json({ ok: true });
  })
);

router.delete(
  "/",
  asyncHandler(async (req, res) => {
    const result = await prisma.notification.deleteMany({
      where: notificationWhere(req)
    });

    clearNotificationsCacheForUser(req.user.id);
    res.json({ ok: true, deletedCount: result.count });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findFirst({
      where: notificationWhere(req, { id: req.params.id })
    });

    if (!notification) throw new ApiError(404, "Notificacao nao encontrada.");

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt || new Date() }
    });

    clearNotificationsCacheForUser(req.user.id);
    res.json({ notification: publicNotification(updated) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await prisma.notification.deleteMany({
      where: notificationWhere(req, { id: req.params.id })
    });

    if (!result.count) throw new ApiError(404, "Notificacao nao encontrada.");

    clearNotificationsCacheForUser(req.user.id);
    res.json({ ok: true });
  })
);

export default router;
