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

const appointmentInclude = {
  client: true,
  service: true
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
        include: appointmentInclude,
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
        include: appointmentInclude,
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
