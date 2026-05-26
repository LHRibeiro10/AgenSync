import { Router } from "express";
import { prisma } from "../prisma.js";
import { syncAppointmentReminders } from "../services/appointmentReminderService.js";
import {
  buildMonthlyPlanOccurrences,
  generationEndDateFromMonths,
  normalizeRecurrenceConfig
} from "../services/monthlyPlanSchedule.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { PLAN_FEATURES, planHasFeature } from "../config/plans.js";
import { addMinutes, combineDateAndTime, formatDate, parseDateOnly, todayString } from "../utils/dates.js";
import {
  isWorkspaceProfessional,
  professionalWhere,
  requireWorkspaceManager,
  resolveProfessionalScope,
  workspaceWhere
} from "../utils/accessControl.js";
import { publicAppointment, publicMonthlyPlan } from "../utils/formatters.js";
import { optionalString, parseBoolean, parsePagination, parsePositiveInteger, parsePositiveMoney, requiredString } from "../utils/validation.js";

const router = Router();

const paymentSelect = {
  id: true,
  month: true,
  status: true,
  dueDate: true,
  paidAt: true,
  amount: true,
  paymentMethod: true,
  notes: true,
  manual: true,
  createdAt: true,
  updatedAt: true
};

const clientSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  notes: true,
  createdAt: true,
  updatedAt: true
};

const serviceSelect = {
  id: true,
  name: true,
  priceDefault: true,
  durationMinutes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};

const professionalSelect = {
  id: true,
  name: true,
  role: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};

const appointmentSelect = {
  id: true,
  workspaceId: true,
  userId: true,
  clientId: true,
  serviceId: true,
  professionalId: true,
  monthlyPlanId: true,
  startsAt: true,
  endsAt: true,
  durationMinutes: true,
  price: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  client: { select: clientSelect },
  service: { select: serviceSelect },
  professional: { select: professionalSelect },
  monthlyPlan: {
    select: {
      id: true,
      planName: true,
      billingType: true,
      status: true
    }
  }
};

const monthlyPlanSelect = {
  id: true,
  workspaceId: true,
  userId: true,
  clientId: true,
  serviceId: true,
  professionalId: true,
  planName: true,
  amount: true,
  dueDay: true,
  startDate: true,
  endDate: true,
  billingType: true,
  priceMode: true,
  monthlyPrice: true,
  sessionPrice: true,
  sessionsPerMonth: true,
  recurrenceType: true,
  recurrenceConfig: true,
  defaultStartTime: true,
  durationMinutes: true,
  generateAppointments: true,
  generatedUntil: true,
  status: true,
  pausedAt: true,
  canceledAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  service: { select: serviceSelect },
  professional: { select: professionalSelect },
  payments: {
    select: paymentSelect,
    orderBy: [{ month: "desc" }]
  }
};

const pad = (value) => String(value).padStart(2, "0");
const FIXED_BILLING_TYPES = new Set(["FIXED_MONTHLY", "PACKAGE_MONTHLY"]);

function monthKey(value = todayString()) {
  return String(value).slice(0, 7);
}

function monthEndDate(month) {
  const [year, number] = month.split("-").map(Number);
  return new Date(year, number, 0).getDate();
}

function dueDateForMonth(month, dueDay) {
  return `${month}-${pad(Math.max(1, Math.min(Number(dueDay || 1), monthEndDate(month))))}`;
}

function startOfMonth(value) {
  const [year, number] = monthKey(value).split("-").map(Number);
  return new Date(year, number - 1, 1);
}

function nextMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function endOfMonthKey(month) {
  return `${month}-${pad(monthEndDate(month))}`;
}

function normalizeEnum(value, map, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return map[normalized] || fallback;
}

function normalizeBillingType(value) {
  return normalizeEnum(
    value,
    {
      per_completed_session: "PER_COMPLETED_SESSION",
      per_session: "PER_COMPLETED_SESSION",
      attendance: "PER_COMPLETED_SESSION",
      fixed_monthly: "FIXED_MONTHLY",
      fixed: "FIXED_MONTHLY",
      package_monthly: "PACKAGE_MONTHLY",
      package: "PACKAGE_MONTHLY"
    },
    "FIXED_MONTHLY"
  );
}

function normalizePriceMode(value, billingType) {
  return normalizeEnum(
    value,
    {
      service_price: "SERVICE_PRICE",
      service: "SERVICE_PRICE",
      custom_session_price: "CUSTOM_SESSION_PRICE",
      custom: "CUSTOM_SESSION_PRICE",
      monthly_price: "MONTHLY_PRICE",
      monthly: "MONTHLY_PRICE"
    },
    billingType === "PER_COMPLETED_SESSION" ? "SERVICE_PRICE" : "MONTHLY_PRICE"
  );
}

function normalizeRecurrenceType(value) {
  return normalizeEnum(
    value,
    {
      weekly: "WEEKLY",
      semanal: "WEEKLY",
      biweekly: "BIWEEKLY",
      quinzenal: "BIWEEKLY",
      monthly: "MONTHLY",
      mensal: "MONTHLY",
      weekdays: "WEEKDAYS",
      week_days: "WEEKDAYS",
      every_x_days: "EVERY_X_DAYS",
      interval: "EVERY_X_DAYS",
      manual_dates: "MANUAL_DATES",
      manual: "MANUAL_DATES"
    },
    "WEEKLY"
  );
}

function normalizePlanStatus(value) {
  return normalizeEnum(
    value,
    {
      active: "ACTIVE",
      ativo: "ACTIVE",
      paused: "PAUSED",
      pausado: "PAUSED",
      canceled: "CANCELED",
      cancelado: "CANCELED"
    },
    "ACTIVE"
  );
}

function normalizePaymentStatus(value) {
  return normalizeEnum(
    value,
    {
      paid: "PAID",
      pago: "PAID",
      pending: "PENDING",
      pendente: "PENDING",
      overdue: "OVERDUE",
      atrasado: "OVERDUE",
      canceled: "CANCELED",
      cancelado: "CANCELED"
    },
    "PENDING"
  );
}

function optionalDate(value, fieldName) {
  if (!value) return null;
  return parseDateOnly(String(value).slice(0, 10), fieldName);
}

function optionalPositiveInteger(value, fieldName, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  return parsePositiveInteger(value, fieldName);
}

function isFixedBilling(plan) {
  return FIXED_BILLING_TYPES.has(plan.billingType || "FIXED_MONTHLY");
}

function shouldIncludePlan(plan, month) {
  if (!isFixedBilling(plan)) return false;
  if (month < monthKey(formatDate(plan.startDate))) return false;
  if (plan.endDate && month > monthKey(formatDate(plan.endDate))) return false;
  if (plan.status === "CANCELED" && plan.canceledAt && month > monthKey(formatDate(plan.canceledAt))) return false;
  return true;
}

function cycleForMonth(plan, month) {
  const publicPlan = publicMonthlyPlan(plan);
  const payment = publicPlan.payments.find((item) => item.month === month);
  const dueDate = payment?.dueDate || dueDateForMonth(month, publicPlan.dueDay);
  const rawStatus = payment?.status || "pending";
  const status = rawStatus === "paid" || rawStatus === "canceled" ? rawStatus : dueDate < todayString() ? "overdue" : rawStatus;

  return {
    id: payment?.id || `${publicPlan.id}_${month}`,
    subscriptionId: publicPlan.id,
    clientId: publicPlan.clientId,
    clientName: publicPlan.clientName,
    planName: publicPlan.planName,
    billingType: publicPlan.billingType,
    amount: payment?.amount ?? publicPlan.monthlyPrice ?? publicPlan.amount,
    dueDay: publicPlan.dueDay,
    dueDate,
    month,
    status,
    paidAt: payment?.paidAt || "",
    paymentMethod: payment?.paymentMethod || "",
    notes: payment?.notes || "",
    subscriptionStatus: publicPlan.status,
    planNotes: publicPlan.notes
  };
}

function cyclesForRange(plans, startDate, endDate) {
  const cycles = [];
  plans.forEach((plan) => {
    let cursor = startOfMonth(startDate);
    const end = startOfMonth(endDate);
    while (cursor <= end) {
      const month = formatDate(cursor).slice(0, 7);
      if (shouldIncludePlan(plan, month)) {
        const cycle = cycleForMonth(plan, month);
        const paidInRange = cycle.status === "paid" && cycle.paidAt >= startDate && cycle.paidAt <= endDate;
        const dueInRange = cycle.dueDate >= startDate && cycle.dueDate <= endDate;
        if (paidInRange || dueInRange) cycles.push(cycle);
      }
      cursor = nextMonth(cursor);
    }
  });

  return cycles.sort((first, second) => `${second.dueDate}${second.clientName}`.localeCompare(`${first.dueDate}${first.clientName}`));
}

async function findPlan(user, id, includeAppointments = false) {
  const scope = await resolveProfessionalScope(prisma, user);
  const plan = await prisma.monthlyPlan.findFirst({
    where: { ...workspaceWhere(user), id, ...professionalWhere(scope) },
    select: includeAppointments
      ? {
          ...monthlyPlanSelect,
          appointments: {
            select: appointmentSelect,
            orderBy: [{ startsAt: "desc" }],
            take: 120
          }
        }
      : monthlyPlanSelect
  });
  if (!plan) throw new ApiError(404, "Mensalidade nao encontrada.");
  return plan;
}

async function findClientOrFail(user, clientId) {
  const client = await prisma.client.findFirst({ where: workspaceWhere(user, { id: clientId }), select: { id: true } });
  if (!client) throw new ApiError(400, "Cliente invalido para esta mensalidade.");
  return client;
}

async function findService(user, serviceId) {
  if (!serviceId) return null;
  const service = await prisma.service.findFirst({
    where: workspaceWhere(user, { id: serviceId }),
    select: serviceSelect
  });
  if (!service) throw new ApiError(400, "Servico invalido para esta mensalidade.");
  return service;
}

async function resolveProfessional(user, professionalId) {
  if (professionalId) {
    const professional = await prisma.professional.findFirst({
      where: workspaceWhere(user, { id: professionalId }),
      select: professionalSelect
    });
    if (!professional) throw new ApiError(400, "Profissional invalido para esta mensalidade.");
    return professional;
  }

  const professionals = await prisma.professional.findMany({
    where: workspaceWhere(user, { isActive: true }),
    select: professionalSelect,
    orderBy: [{ createdAt: "asc" }],
    take: 2
  });

  if (professionals.length === 1) return professionals[0];
  if (professionals.length > 1) throw new ApiError(400, "Selecione um profissional responsavel para este mensalista.");
  return null;
}

async function buildPlanDraft(req, body, currentPlan = null) {
  const user = req.user;
  const clientId = requiredString(body.clientId ?? currentPlan?.clientId, "cliente");
  await findClientOrFail(user, clientId);

  const billingType = normalizeBillingType(body.billingType ?? currentPlan?.billingType);
  const service = await findService(user, body.serviceId ?? currentPlan?.serviceId ?? "");
  const shouldGenerate = parseBoolean(body.generateAppointments ?? currentPlan?.generateAppointments, false);

  if (shouldGenerate && !service) {
    throw new ApiError(400, "Selecione um servico para gerar atendimentos na agenda.");
  }

  const professional = await resolveProfessional(user, body.professionalId ?? currentPlan?.professionalId ?? "");
  if (shouldGenerate && !professional) {
    throw new ApiError(400, "Cadastre um profissional antes de gerar atendimentos recorrentes.");
  }

  const priceMode = normalizePriceMode(body.priceMode ?? currentPlan?.priceMode, billingType);
  const sessionsPerMonth = Math.max(1, optionalPositiveInteger(body.sessionsPerMonth ?? currentPlan?.sessionsPerMonth, "quantidade de atendimentos", 1));
  const monthlyPrice = parsePositiveMoney(body.monthlyPrice ?? body.amount ?? currentPlan?.monthlyPrice ?? currentPlan?.amount ?? 0, "valor mensal");
  const sessionPrice =
    priceMode === "SERVICE_PRICE" && service
      ? Number(service.priceDefault)
      : parsePositiveMoney(body.sessionPrice ?? currentPlan?.sessionPrice ?? service?.priceDefault ?? monthlyPrice, "valor por atendimento");
  const amount = billingType === "PER_COMPLETED_SESSION" ? Number((sessionPrice * sessionsPerMonth).toFixed(2)) : monthlyPrice;
  const startDate = optionalDate(body.startDate ?? (currentPlan ? formatDate(currentPlan.startDate) : todayString()), "data de inicio");
  const endDate = optionalDate(body.endDate ?? (currentPlan?.endDate ? formatDate(currentPlan.endDate) : ""), "data de fim");

  if (endDate && endDate < startDate) {
    throw new ApiError(400, "A data de fim precisa ser posterior a data de inicio.");
  }

  const recurrenceType = normalizeRecurrenceType(body.recurrenceType ?? currentPlan?.recurrenceType);
  const recurrenceConfig = normalizeRecurrenceConfig({
    recurrenceType,
    recurrenceConfig: body.recurrenceConfig ?? currentPlan?.recurrenceConfig ?? {},
    startDate
  });
  const durationMinutes =
    optionalPositiveInteger(body.durationMinutes ?? currentPlan?.durationMinutes ?? service?.durationMinutes, "duracao", null) ||
    service?.durationMinutes ||
    60;
  const defaultStartTime = body.defaultStartTime ?? currentPlan?.defaultStartTime ?? "";

  if (shouldGenerate && !defaultStartTime) {
    throw new ApiError(400, "Informe o horario padrao para gerar a agenda.");
  }

  return {
    userId: user.id,
    clientId,
    serviceId: service?.id || null,
    professionalId: professional?.id || null,
    planName: requiredString(body.planName ?? currentPlan?.planName, "nome do plano", 2),
    amount,
    dueDay: Math.min(optionalPositiveInteger(body.dueDay ?? currentPlan?.dueDay, "dia de vencimento", 10), 31),
    startDate,
    endDate,
    billingType,
    priceMode,
    monthlyPrice: billingType === "PER_COMPLETED_SESSION" ? null : monthlyPrice,
    sessionPrice,
    sessionsPerMonth,
    recurrenceType,
    recurrenceConfig,
    defaultStartTime: defaultStartTime || null,
    durationMinutes,
    generateAppointments: shouldGenerate,
    status: normalizePlanStatus(body.status ?? currentPlan?.status),
    notes: optionalString(body.notes ?? currentPlan?.notes ?? ""),
    service,
    professional
  };
}

function publicOccurrence(occurrence) {
  return {
    date: occurrence.date,
    startTime: occurrence.startTime,
    endTime: `${pad(occurrence.endsAt.getHours())}:${pad(occurrence.endsAt.getMinutes())}`,
    startsAt: occurrence.startsAt,
    endsAt: occurrence.endsAt,
    month: occurrence.month
  };
}

function appointmentKey(startsAt, endsAt) {
  return `${startsAt.getTime()}_${endsAt.getTime()}`;
}

async function scheduleAnalysis({ userId, workspaceId = "", professionalId, occurrences, monthlyPlanId = "" }) {
  if (!occurrences.length || !professionalId) return { conflicts: [], duplicates: new Set() };
  const starts = occurrences.map((item) => item.startsAt.getTime());
  const ends = occurrences.map((item) => item.endsAt.getTime());
  const rangeStart = new Date(Math.min(...starts));
  const rangeEnd = new Date(Math.max(...ends));

  const existing = await prisma.appointment.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : { userId }),
      professionalId,
      status: { not: "CANCELED" },
      startsAt: { lt: rangeEnd },
      endsAt: { gt: rangeStart }
    },
    select: {
      id: true,
      monthlyPlanId: true,
      startsAt: true,
      endsAt: true,
      client: { select: { name: true } },
      service: { select: { name: true } },
      professional: { select: { name: true } }
    }
  });

  const conflicts = [];
  const duplicates = new Set();

  occurrences.forEach((occurrence) => {
    const duplicate = existing.find(
      (appointment) =>
        monthlyPlanId &&
        appointment.monthlyPlanId === monthlyPlanId &&
        appointment.startsAt.getTime() === occurrence.startsAt.getTime()
    );
    if (duplicate) {
      duplicates.add(appointmentKey(occurrence.startsAt, occurrence.endsAt));
      return;
    }

    const conflict = existing.find(
      (appointment) => appointment.startsAt < occurrence.endsAt && appointment.endsAt > occurrence.startsAt
    );
    if (conflict) {
      conflicts.push({
        ...publicOccurrence(occurrence),
        conflict: {
          id: conflict.id,
          clientName: conflict.client?.name || "",
          serviceName: conflict.service?.name || "",
          professionalName: conflict.professional?.name || ""
        }
      });
    }
  });

  return { conflicts, duplicates };
}

async function generateAppointmentsForPlan(plan, options = {}) {
  if (!plan.serviceId || !plan.professionalId) {
    throw new ApiError(400, "Mensalidade sem servico ou profissional nao pode gerar agenda.");
  }

  const startDate =
    options.startDate ||
    (plan.generatedUntil
      ? formatDate(addMinutes(parseDateOnly(formatDate(plan.generatedUntil)), 24 * 60))
      : formatDate(plan.startDate));
  const endDate = options.endDate || generationEndDateFromMonths(startDate, options.months || 1);
  const occurrences = buildMonthlyPlanOccurrences(plan, { startDate, endDate, months: options.months || 1 });
  const { conflicts, duplicates } = await scheduleAnalysis({
    userId: plan.userId,
    workspaceId: plan.workspaceId || "",
    professionalId: plan.professionalId,
    occurrences,
    monthlyPlanId: plan.id
  });
  const conflictKeys = new Set(conflicts.map((item) => appointmentKey(new Date(item.startsAt), new Date(item.endsAt))));
  const skipConflicts = parseBoolean(options.skipConflicts, true);

  if (conflicts.length && !skipConflicts) {
    throw new ApiError(409, "Existem conflitos de horario antes de gerar a agenda.", {
      code: "MONTHLY_PLAN_CONFLICTS",
      conflicts
    });
  }

  const available = occurrences.filter((occurrence) => {
    const key = appointmentKey(occurrence.startsAt, occurrence.endsAt);
    return !duplicates.has(key) && !conflictKeys.has(key);
  });

  if (available.length) {
    const sessionPrice = plan.billingType === "PER_COMPLETED_SESSION" ? Number(plan.sessionPrice || plan.amount || 0) : 0;
    await prisma.appointment.createMany({
      data: available.map((occurrence) => ({
        workspaceId: plan.workspaceId || null,
        userId: plan.userId,
        clientId: plan.clientId,
        serviceId: plan.serviceId,
        professionalId: plan.professionalId,
        monthlyPlanId: plan.id,
        startsAt: occurrence.startsAt,
        endsAt: occurrence.endsAt,
        durationMinutes: plan.durationMinutes || null,
        price: sessionPrice,
        notes: plan.notes ? `Mensalidade: ${plan.planName}\n${plan.notes}` : `Mensalidade: ${plan.planName}`,
        status: "SCHEDULED"
      })),
      skipDuplicates: true
    });

    const generatedAppointments = await prisma.appointment.findMany({
      where: {
        ...(plan.workspaceId ? { workspaceId: plan.workspaceId } : { userId: plan.userId }),
        monthlyPlanId: plan.id,
        startsAt: { in: available.map((item) => item.startsAt) }
      },
      select: {
        id: true,
        userId: true,
        startsAt: true,
        status: true
      }
    });

    for (const appointment of generatedAppointments) {
      await syncAppointmentReminders(appointment);
    }
  }

  const generatedUntil = available.length ? available[available.length - 1].startsAt : plan.generatedUntil;
  if (generatedUntil) {
    await prisma.monthlyPlan.update({
      where: { id: plan.id },
      data: { generatedUntil }
    });
  }

  return {
    generatedCount: available.length,
    skippedCount: conflicts.length + duplicates.size,
    conflicts,
    duplicatesCount: duplicates.size,
    startDate,
    endDate
  };
}

async function appointmentsForPlans(reqOrUser, planIds, startDate, endDate) {
  if (!planIds.length) return [];
  return prisma.appointment.findMany({
    where: {
      ...workspaceWhere(reqOrUser),
      monthlyPlanId: { in: planIds },
      startsAt: { gte: parseDateOnly(startDate), lt: addMinutes(parseDateOnly(endDate), 24 * 60) }
    },
    select: appointmentSelect,
    orderBy: [{ startsAt: "asc" }]
  });
}

function attachMonthMetrics(plans, appointments) {
  const grouped = new Map();
  appointments.forEach((appointment) => {
    const list = grouped.get(appointment.monthlyPlanId) || [];
    list.push(publicAppointment(appointment));
    grouped.set(appointment.monthlyPlanId, list);
  });

  return plans.map((plan) => {
    const sessions = grouped.get(plan.id) || [];
    return {
      ...publicMonthlyPlan(plan),
      monthSessions: sessions.length,
      completedSessions: sessions.filter((appointment) => appointment.status === "concluido").length,
      scheduledSessions: sessions.filter((appointment) => appointment.status === "agendado").length,
      nextSessions: sessions.filter((appointment) => appointment.status === "agendado").slice(0, 3)
    };
  });
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const canFilterProfessionals =
      isWorkspaceProfessional(req.user) || planHasFeature(req.user, PLAN_FEATURES.PROFESSIONAL_FILTERS);
    const scope = await resolveProfessionalScope(
      prisma,
      req.user,
      canFilterProfessionals ? req.query.professionalId : ""
    );
    const month = monthKey(req.query.month || req.query.endDate || todayString());
    const includeCycles = req.query.includeCycles === "true";
    const includeSummary = req.query.includeSummary === "true";
    const startDate = req.query.startDate || `${month}-01`;
    const endDate = req.query.endDate || endOfMonthKey(month);
    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });

    const plans = await prisma.monthlyPlan.findMany({
      where: {
        ...workspaceWhere(req),
        ...professionalWhere(scope),
        ...(req.query.status ? { status: normalizePlanStatus(req.query.status) } : {}),
        ...(req.query.billingType ? { billingType: normalizeBillingType(req.query.billingType) } : {}),
        ...(req.query.clientId ? { clientId: String(req.query.clientId) } : {})
      },
      ...(!includeCycles && !includeSummary && pagination.enabled ? { skip: pagination.skip, take: pagination.take } : {}),
      select: monthlyPlanSelect,
      orderBy: [{ createdAt: "desc" }]
    });

    if (includeCycles) {
      return res.json({ cycles: cyclesForRange(plans, startDate, endDate) });
    }

    const monthAppointments = await appointmentsForPlans(
      req,
      plans.map((plan) => plan.id),
      startDate,
      endDate
    );

    if (includeSummary) {
      const cycles = cyclesForRange(plans, startDate, endDate);
      const perSessionAppointments = monthAppointments.filter(
        (appointment) => appointment.monthlyPlan?.billingType === "PER_COMPLETED_SESSION" && appointment.status !== "CANCELED"
      );
      const completedPerSessionAppointments = perSessionAppointments.filter((appointment) => appointment.status === "COMPLETED");
      const expectedFromSessions = perSessionAppointments.reduce((total, appointment) => total + Number(appointment.price || 0), 0);
      const receivedFromSessions = completedPerSessionAppointments.reduce((total, appointment) => total + Number(appointment.price || 0), 0);
      const expectedFromFixed = cycles.reduce((total, cycle) => total + Number(cycle.amount || 0), 0);
      const receivedFromFixed = cycles
        .filter((cycle) => cycle.status === "paid")
        .reduce((total, cycle) => total + Number(cycle.amount || 0), 0);

      return res.json({
        summary: {
          activeCount: plans.filter((plan) => plan.status === "ACTIVE").length,
          pausedCount: plans.filter((plan) => plan.status === "PAUSED").length,
          sessionsExpected: monthAppointments.filter((appointment) => appointment.status !== "CANCELED").length,
          sessionsCompleted: monthAppointments.filter((appointment) => appointment.status === "COMPLETED").length,
          pending: cycles.filter((cycle) => cycle.status === "pending").length,
          overdue: cycles.filter((cycle) => cycle.status === "overdue").length,
          paid: cycles.filter((cycle) => cycle.status === "paid").length,
          expected: expectedFromFixed + expectedFromSessions,
          received: receivedFromFixed + receivedFromSessions,
          pendingAmount: Math.max(expectedFromFixed + expectedFromSessions - receivedFromFixed - receivedFromSessions, 0),
          cycles
        }
      });
    }

    const publicPlans = attachMonthMetrics(plans, monthAppointments).map((plan) => ({
      ...plan,
      currentCycle: shouldIncludePlan(plans.find((item) => item.id === plan.id), month)
        ? cycleForMonth(plans.find((item) => item.id === plan.id), month)
        : null
    }));

    res.json({ monthlyPlans: publicPlans });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const plan = await findPlan(req.user, req.params.id, true);
    res.json({ monthlyPlan: publicMonthlyPlan(plan) });
  })
);

router.post(
  "/preview",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const draft = await buildPlanDraft(req, req.body);
    const endDate = req.body.previewEndDate || generationEndDateFromMonths(formatDate(draft.startDate), req.body.generationMonths || 1);
    const occurrences = buildMonthlyPlanOccurrences(draft, { startDate: formatDate(draft.startDate), endDate });
    const analysis = await scheduleAnalysis({
      userId: req.user.id,
      workspaceId: req.workspaceId || "",
      professionalId: draft.professionalId,
      occurrences
    });
    const conflictKeys = new Set(analysis.conflicts.map((item) => appointmentKey(new Date(item.startsAt), new Date(item.endsAt))));

    res.json({
      preview: occurrences.map((occurrence) => ({
        ...publicOccurrence(occurrence),
        hasConflict: conflictKeys.has(appointmentKey(occurrence.startsAt, occurrence.endsAt))
      })),
      conflicts: analysis.conflicts,
      availableCount: occurrences.length - analysis.conflicts.length
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const draft = await buildPlanDraft(req, req.body);
    const shouldCreateFirstPayment = isFixedBilling(draft);
    const firstMonth = monthKey(formatDate(draft.startDate));
    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.monthlyPlan.create({
        data: {
          workspaceId: req.workspaceId || null,
          userId: req.user.id,
          clientId: draft.clientId,
          serviceId: draft.serviceId,
          professionalId: draft.professionalId,
          planName: draft.planName,
          amount: draft.amount,
          dueDay: draft.dueDay,
          startDate: draft.startDate,
          endDate: draft.endDate,
          billingType: draft.billingType,
          priceMode: draft.priceMode,
          monthlyPrice: draft.monthlyPrice,
          sessionPrice: draft.sessionPrice,
          sessionsPerMonth: draft.sessionsPerMonth,
          recurrenceType: draft.recurrenceType,
          recurrenceConfig: draft.recurrenceConfig,
          defaultStartTime: draft.defaultStartTime,
          durationMinutes: draft.durationMinutes,
          generateAppointments: draft.generateAppointments,
          status: draft.status,
          pausedAt: draft.status === "PAUSED" ? new Date() : null,
          canceledAt: draft.status === "CANCELED" ? new Date() : null,
          notes: draft.notes,
          ...(shouldCreateFirstPayment
            ? {
                payments: {
                  create: {
                    month: firstMonth,
                    status: "PENDING",
                    dueDate: parseDateOnly(dueDateForMonth(firstMonth, draft.dueDay)),
                    amount: draft.monthlyPrice || draft.amount
                  }
                }
              }
            : {})
        },
        select: monthlyPlanSelect
      });
      return plan;
    });

    const generation = draft.generateAppointments
      ? await generateAppointmentsForPlan(result, {
          startDate: formatDate(draft.startDate),
          months: req.body.generationMonths || 1,
          skipConflicts: req.body.skipConflicts !== false
        })
      : null;

    const plan = await findPlan(req.user, result.id);
    res.status(201).json({ monthlyPlan: publicMonthlyPlan(plan), generation });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const current = await findPlan(req.user, req.params.id);
    const draft = await buildPlanDraft(req, req.body, current);

    const plan = await prisma.monthlyPlan.update({
      where: { id: req.params.id },
      data: {
        clientId: draft.clientId,
        serviceId: draft.serviceId,
        professionalId: draft.professionalId,
        planName: draft.planName,
        amount: draft.amount,
        dueDay: draft.dueDay,
        startDate: draft.startDate,
        endDate: draft.endDate,
        billingType: draft.billingType,
        priceMode: draft.priceMode,
        monthlyPrice: draft.monthlyPrice,
        sessionPrice: draft.sessionPrice,
        sessionsPerMonth: draft.sessionsPerMonth,
        recurrenceType: draft.recurrenceType,
        recurrenceConfig: draft.recurrenceConfig,
        defaultStartTime: draft.defaultStartTime,
        durationMinutes: draft.durationMinutes,
        generateAppointments: draft.generateAppointments,
        status: draft.status,
        pausedAt: draft.status === "PAUSED" ? current.pausedAt || new Date() : null,
        canceledAt: draft.status === "CANCELED" ? current.canceledAt || new Date() : null,
        notes: draft.notes
      },
      select: monthlyPlanSelect
    });

    res.json({ monthlyPlan: publicMonthlyPlan(plan) });
  })
);

router.post(
  "/:id/generate",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const plan = await findPlan(req.user, req.params.id);
    if (plan.status === "CANCELED") throw new ApiError(400, "Mensalidade cancelada nao pode gerar agenda.");

    const generation = await generateAppointmentsForPlan(plan, {
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      months: req.body.generationMonths || 1,
      skipConflicts: req.body.skipConflicts !== false
    });
    const updated = await findPlan(req.user, req.params.id);
    res.json({ monthlyPlan: publicMonthlyPlan(updated), generation });
  })
);

router.post(
  "/:id/cancel-future-appointments",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const plan = await findPlan(req.user, req.params.id);
    const fromDate = optionalDate(req.body.fromDate || todayString(), "data inicial");
    const result = await prisma.appointment.updateMany({
      where: {
        ...workspaceWhere(req),
        monthlyPlanId: plan.id,
        status: "SCHEDULED",
        startsAt: { gte: fromDate }
      },
      data: { status: "CANCELED" }
    });

    const reminders = await prisma.appointment.findMany({
      where: {
        ...workspaceWhere(req),
        monthlyPlanId: plan.id,
        startsAt: { gte: fromDate }
      },
      select: { id: true, userId: true, startsAt: true, status: true }
    });
    for (const appointment of reminders) {
      await syncAppointmentReminders(appointment);
    }

    res.json({ canceledCount: result.count });
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    await findPlan(req.user, req.params.id);
    const plan = await prisma.monthlyPlan.update({
      where: { id: req.params.id },
      data: { status: "CANCELED", canceledAt: new Date() },
      select: monthlyPlanSelect
    });
    res.json({ monthlyPlan: publicMonthlyPlan(plan) });
  })
);

router.post(
  "/:id/payments",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const plan = await findPlan(req.user, req.params.id);
    if (!isFixedBilling(plan)) {
      throw new ApiError(400, "Pagamentos por competencia sao usados apenas em planos mensais fixos ou pacotes.");
    }

    const month = monthKey(req.body.month || todayString());
    const status = normalizePaymentStatus(req.body.status);
    const amount = parsePositiveMoney(req.body.amount ?? plan.monthlyPrice ?? plan.amount, "valor");
    const dueDate = optionalDate(req.body.dueDate || dueDateForMonth(month, plan.dueDay), "data de vencimento");
    const paidAt = status === "PAID" ? optionalDate(req.body.paidAt || todayString(), "data de pagamento") : null;

    const payment = await prisma.monthlyPlanPayment.upsert({
      where: { monthlyPlanId_month: { monthlyPlanId: plan.id, month } },
      create: {
        monthlyPlanId: plan.id,
        month,
        status,
        dueDate,
        paidAt,
        amount,
        paymentMethod: optionalString(req.body.paymentMethod),
        notes: optionalString(req.body.notes),
        manual: true
      },
      update: {
        status,
        dueDate,
        paidAt,
        amount,
        paymentMethod: optionalString(req.body.paymentMethod),
        notes: optionalString(req.body.notes),
        manual: true
      },
      select: paymentSelect
    });

    const updatedPlan = {
      ...plan,
      payments: [...plan.payments.filter((item) => item.month !== month), payment]
    };

    res.json({ cycle: cycleForMonth(updatedPlan, month) });
  })
);

export default router;
