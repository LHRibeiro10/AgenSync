import { prisma } from "../prisma.js";
import { publicAppointment } from "../utils/formatters.js";
import { createInternalNotification, publicNotification } from "./notificationService.js";

const REMINDER_TYPES_BY_OFFSET = {
  10: "TEN_MINUTES_BEFORE",
  15: "FIFTEEN_MINUTES_BEFORE",
  30: "THIRTY_MINUTES_BEFORE",
  60: "ONE_HOUR_BEFORE",
  120: "TWO_HOURS_BEFORE",
  1440: "ONE_DAY_BEFORE"
};

const OFFSET_BY_REMINDER_TYPE = Object.fromEntries(
  Object.entries(REMINDER_TYPES_BY_OFFSET).map(([offset, type]) => [type, Number(offset)])
);

const NOTIFIABLE_STATUSES = new Set(["SCHEDULED"]);

function normalizeReminderOffset(value) {
  const offset = Number(value || 30);
  return REMINDER_TYPES_BY_OFFSET[offset] ? offset : 30;
}

function offsetLabel(minutes) {
  if (minutes === 60) return "1 hora";
  if (minutes === 120) return "2 horas";
  if (minutes === 1440) return "1 dia";
  return `${minutes} minutos`;
}

async function reminderSettingsForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      appointmentNotificationsEnabled: true,
      appointmentNotificationOffsetMinutes: true,
      appointmentNotificationChannels: true
    }
  });

  const channels = Array.isArray(user?.appointmentNotificationChannels)
    ? user.appointmentNotificationChannels
    : ["internal", "push"];

  return {
    enabled: user?.appointmentNotificationsEnabled !== false,
    offsetMinutes: normalizeReminderOffset(user?.appointmentNotificationOffsetMinutes),
    channels
  };
}

async function cancelPendingReminders(appointmentId, errorMessage) {
  await prisma.appointmentReminder.updateMany({
    where: { appointmentId, status: "PENDING" },
    data: { status: "FAILED", errorMessage }
  });
}

export async function syncAppointmentReminders(appointment) {
  if (!appointment?.id || !appointment?.startsAt) return;

  if (!NOTIFIABLE_STATUSES.has(appointment.status)) {
    await cancelPendingReminders(appointment.id, "Agendamento sem status notificavel.");
    return;
  }

  const settings = await reminderSettingsForUser(appointment.userId);
  if (!settings.enabled) {
    await cancelPendingReminders(appointment.id, "Notificacoes desativadas.");
    return;
  }

  const startsAt = new Date(appointment.startsAt).getTime();
  const reminderType = REMINDER_TYPES_BY_OFFSET[settings.offsetMinutes];
  const scheduledFor = new Date(startsAt - settings.offsetMinutes * 60 * 1000);
  const now = Date.now();

  await prisma.appointmentReminder.updateMany({
    where: {
      appointmentId: appointment.id,
      status: "PENDING",
      reminderType: { not: reminderType }
    },
    data: { status: "FAILED", errorMessage: "Substituido pela configuracao atual." }
  });

  if (startsAt <= now) return;

  const reminderKey = {
    appointmentId_reminderType: {
      appointmentId: appointment.id,
      reminderType
    }
  };
  const existing = await prisma.appointmentReminder.findUnique({
    where: reminderKey
  });

  if (existing?.status === "SENT" && existing.scheduledFor.getTime() === scheduledFor.getTime()) {
    return;
  }

  if (!existing) {
    await prisma.appointmentReminder.create({
      data: {
        appointmentId: appointment.id,
        userId: appointment.userId,
        reminderType,
        scheduledFor
      }
    });
    return;
  }

  await prisma.appointmentReminder.update({
    where: { id: existing.id },
    data: {
      appointmentId: appointment.id,
      userId: appointment.userId,
      reminderType,
      scheduledFor,
      status: "PENDING",
      sentAt: null,
      errorMessage: null
    }
  });
}

export async function rescheduleFutureAppointmentRemindersForUser(userId) {
  const appointments = await prisma.appointment.findMany({
    where: {
      userId,
      startsAt: { gt: new Date() },
      status: { in: [...NOTIFIABLE_STATUSES] }
    },
    select: {
      id: true,
      userId: true,
      startsAt: true,
      status: true
    },
    orderBy: [{ startsAt: "asc" }],
    take: 500
  });

  for (const appointment of appointments) {
    await syncAppointmentReminders(appointment);
  }

  return { rescheduled: appointments.length };
}

export async function processDueAppointmentReminders({ limit = 50, userId = "" } = {}) {
  const dueReminders = await prisma.appointmentReminder.findMany({
    where: {
      ...(userId ? { userId } : {}),
      status: "PENDING",
      scheduledFor: { lte: new Date() },
      sentAt: null
    },
    include: {
      appointment: {
        include: {
          client: true,
          service: true,
          professional: true
        }
      }
    },
    orderBy: [{ scheduledFor: "asc" }],
    take: Math.min(Math.max(Number(limit) || 50, 1), 100)
  });

  const results = { processed: 0, sent: 0, failed: 0, notifications: [] };

  for (const reminder of dueReminders) {
    results.processed += 1;

    const claimed = await prisma.appointmentReminder.updateMany({
      where: { id: reminder.id, status: "PENDING", sentAt: null },
      data: { status: "PROCESSING" }
    });

    if (!claimed.count) continue;

    try {
      if (!NOTIFIABLE_STATUSES.has(reminder.appointment.status)) {
        throw new Error("Agendamento sem status notificavel.");
      }

      const settings = await reminderSettingsForUser(reminder.userId);
      if (!settings.enabled) {
        throw new Error("Notificacoes desativadas.");
      }

      const offsetMinutes = OFFSET_BY_REMINDER_TYPE[reminder.reminderType] || settings.offsetMinutes;
      const appointment = publicAppointment(reminder.appointment);
      const notification = await createInternalNotification({
        userId: reminder.userId,
        workspaceId: reminder.userId,
        title: `Próximo atendimento em ${offsetLabel(offsetMinutes)}`,
        body: `${appointment.client?.name || "Cliente"} - ${appointment.service?.name || "Serviço"} às ${appointment.startTime}`,
        type: "appointment_reminder",
        actionUrl: `/agenda?agendamento=${appointment.id}`,
        relatedEntityType: "appointment",
        relatedEntityId: appointment.id,
        push: settings.channels.includes("push")
      });
      results.notifications.push(publicNotification(notification));

      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: { status: "SENT", sentAt: new Date(), errorMessage: null }
      });
      results.sent += 1;
    } catch (error) {
      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: {
          status: "FAILED",
          errorMessage: String(error?.message || "Falha ao enviar lembrete.").slice(0, 500)
        }
      });
      results.failed += 1;
    }
  }

  return results;
}
