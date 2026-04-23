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
const DASHBOARD_CACHE_TTL_MS = 10_000;
const DASHBOARD_CACHE_MAX_ITEMS = 200;
const dashboardCache = new Map();

const appointmentSelect = {
  id: true,
  clientId: true,
  serviceId: true,
  professionalId: true,
  startsAt: true,
  endsAt: true,
  durationMinutes: true,
  price: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      name: true
    }
  },
  service: {
    select: {
      id: true,
      name: true,
      priceDefault: true,
      durationMinutes: true
    }
  }
};

function getCachedDashboard(key) {
  const cached = dashboardCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    dashboardCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedDashboard(key, value) {
  if (dashboardCache.size >= DASHBOARD_CACHE_MAX_ITEMS) {
    const oldestKey = dashboardCache.keys().next().value;
    if (oldestKey) dashboardCache.delete(oldestKey);
  }

  dashboardCache.set(key, {
    value,
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS
  });
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const dateParam = req.query.date || todayString();
    const cacheKey = `${req.user.id}:${dateParam}`;
    const cached = getCachedDashboard(cacheKey);
    if (cached) return res.json(cached);

    const selectedDate = parseDateOnly(dateParam);
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

    const payload = {
      date: dateParam,
      appointmentsToday: todayAppointments.length,
      earnedToday: Number(todayRevenue._sum.price || 0),
      earnedMonth: Number(monthRevenue._sum.price || 0),
      nextAppointment: nextAppointment ? publicAppointment(nextAppointment) : null,
      todayAppointments: todayAppointments.map(publicAppointment)
    };

    setCachedDashboard(cacheKey, payload);
    res.json(payload);
  })
);

export default router;
