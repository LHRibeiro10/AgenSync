import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../middleware/error.js";
import {
  endOfDay,
  endOfMonth,
  parseDateOnly,
  startOfDay,
  startOfMonth,
  startOfWeek,
  todayString
} from "../utils/dates.js";

const router = Router();

async function revenue(userId, startsAt) {
  const result = await prisma.appointment.aggregate({
    where: {
      userId,
      status: "COMPLETED",
      startsAt
    },
    _sum: { price: true }
  });

  return Number(result._sum.price || 0);
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const selectedDate = parseDateOnly(req.query.date || todayString());
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    const weekStart = startOfWeek(selectedDate);
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);

    const [today, week, month, completedMonth] = await Promise.all([
      revenue(req.user.id, { gte: dayStart, lt: dayEnd }),
      revenue(req.user.id, { gte: weekStart, lt: dayEnd }),
      revenue(req.user.id, { gte: monthStart, lt: monthEnd }),
      prisma.appointment.count({
        where: {
          userId: req.user.id,
          status: "COMPLETED",
          startsAt: { gte: monthStart, lt: monthEnd }
        }
      })
    ]);

    res.json({
      totalReceivedToday: today,
      totalReceivedWeek: week,
      totalReceivedMonth: month,
      completedAppointmentsMonth: completedMonth
    });
  })
);

export default router;
