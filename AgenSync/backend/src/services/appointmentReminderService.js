import { prisma } from "../prisma.js";
import { publicAppointment } from "../utils/formatters.js";
import { createInternalNotification } from "./notificationService.js";

const REMINDER_OFFSETS = [
  ["ONE_DAY_BEFORE", 24 * 60 * 60 * 1000],
  ["TWO_HOURS_BEFORE", 2 * 60 * 60 * 1000],
  ["THIRTY_MINUTES_BEFORE", 30 * 60 * 1000]
];

export async function syncAppointmentReminders(appointment) {
  if (!appointment?.id || !appointment?.startsAt) return;

  if (appointment.status === "CANCELED") {
    await prisma.appointmentReminder.updateMany({
      where: { appointmentId: appointment.id, status: "PENDING" },
      data: { status: "FAILED", errorMessage: "Agendamento cancelado." }
    });
    return;
  }

  const startsAt = new Date(appointment.startsAt).getTime();
  const now = Date.now();

  await Promise.all(
    REMINDER_OFFSETS.map(([reminderType, offsetMs]) => {
      const scheduledFor = new Date(startsAt - offsetMs);
      if (scheduledFor.getTime() <= now) return null;

      return prisma.appointmentReminder.upsert({
        where: {
          appointmentId_reminderType: {
            appointmentId: appointment.id,
            reminderType
          }
        },
        create: {
          appointmentId: appointment.id,
          userId: appointment.userId,
          reminderType,
          scheduledFor
        },
        update: {
          userId: appointment.userId,
          scheduledFor,
          status: "PENDING",
          sentAt: null,
          errorMessage: null
        }
      });
    })
  );
}

export async function processDueAppointmentReminders({ limit = 50 } = {}) {
  const dueReminders = await prisma.appointmentReminder.findMany({
    where: {
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

  const results = { processed: 0, sent: 0, failed: 0 };

  for (const reminder of dueReminders) {
    results.processed += 1;

    const claimed = await prisma.appointmentReminder.updateMany({
      where: { id: reminder.id, status: "PENDING", sentAt: null },
      data: { status: "PROCESSING" }
    });

    if (!claimed.count) continue;

    try {
      const appointment = publicAppointment(reminder.appointment);
      await createInternalNotification({
        userId: reminder.userId,
        title: "Lembrete de agendamento",
        body: `${appointment.client?.name || "Cliente"} as ${appointment.startTime} - ${appointment.service?.name || "Servico"}`,
        type: "appointment_reminder",
        actionUrl: "/agenda"
      });

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
