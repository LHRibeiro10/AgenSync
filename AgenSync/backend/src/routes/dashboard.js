import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../middleware/error.js";
import {
  endOfDay,
  endOfMonth,
  parseDateOnly,
  startOfDay,
  startOfMonth,
  todayString
} from "../utils/dates.js";
import { publicAppointment } from "../utils/formatters.js";

const router = Router();

const appointmentSelect = {
  id: true,
  clientId: true,
  serviceId: true,
  professionalId: true,
  startsAt: true,
  endsAt: true,
  price: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      name: true,
      phone: true,
      notes: true,
      createdAt: true,
      updatedAt: true
    }
  },
  service: {
    select: {
      id: true,
      name: true,
      priceDefault: true,
      durationMinutes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  }
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const selectedDate = parseDateOnly(req.query.date || todayString());
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);

    const [todayAppointments, todayRevenue, monthRevenue, nextAppointment] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          userId: req.user.id,
          startsAt: { gte: dayStart, lt: dayEnd }
        },
        select: appointmentSelect,
        orderBy: [{ startsAt: "asc" }]
      }),
      prisma.appointment.aggregate({
        where: {
          userId: req.user.id,
          status: "COMPLETED",
          startsAt: { gte: dayStart, lt: dayEnd }
        },
        _sum: { price: true }
      }),
      prisma.appointment.aggregate({
        where: {
          userId: req.user.id,
          status: "COMPLETED",
          startsAt: { gte: monthStart, lt: monthEnd }
        },
        _sum: { price: true }
      }),
      prisma.appointment.findFirst({
        where: {
          userId: req.user.id,
          status: "SCHEDULED",
          startsAt: { gte: new Date() }
        },
        select: appointmentSelect,
        orderBy: [{ startsAt: "asc" }]
      })
    ]);

    res.json({
      date: req.query.date || todayString(),
      appointmentsToday: todayAppointments.length,
      earnedToday: Number(todayRevenue._sum.price || 0),
      earnedMonth: Number(monthRevenue._sum.price || 0),
      nextAppointment: nextAppointment ? publicAppointment(nextAppointment) : null,
      todayAppointments: todayAppointments.map(publicAppointment)
    });
  })
);

export default router;
