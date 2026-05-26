import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { PLAN_FEATURES, planHasFeature } from "../config/plans.js";
import { isWorkspaceProfessional, professionalWhere, resolveProfessionalScope, workspaceWhere } from "../utils/accessControl.js";
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

async function revenue(req, startsAt, scope) {
  const result = await prisma.appointment.aggregate({
    where: {
      ...workspaceWhere(req),
      ...professionalWhere(scope),
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
    const canFilterProfessionals =
      isWorkspaceProfessional(req.user) || planHasFeature(req.user, PLAN_FEATURES.PROFESSIONAL_FILTERS);
    const scope = await resolveProfessionalScope(
      prisma,
      req.user,
      canFilterProfessionals ? req.query.professionalId : ""
    );
    const scopeWhere = professionalWhere(scope);

    const [today, week, month, completedMonth] = await Promise.all([
      revenue(req, { gte: dayStart, lt: dayEnd }, scope),
      revenue(req, { gte: weekStart, lt: dayEnd }, scope),
      revenue(req, { gte: monthStart, lt: monthEnd }, scope),
      prisma.appointment.count({
        where: {
          ...workspaceWhere(req),
          ...scopeWhere,
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
