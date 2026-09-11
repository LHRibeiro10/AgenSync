import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { PLAN_FEATURES, planHasFeature } from "../config/plans.js";
import { addMinutes, combineDateAndTime, dateRangeFromQuery } from "../utils/dates.js";
import {
  assertProfessionalBelongsToUser,
  clientAccessWhere,
  isWorkspaceProfessional,
  professionalWhere,
  resolveProfessionalScope,
  workspaceWhere
} from "../utils/accessControl.js";
import { normalizeStatus, publicAppointment, publicClient, publicProfessional, publicService } from "../utils/formatters.js";
import { syncAppointmentReminders } from "../services/appointmentReminderService.js";
import { clearProfessionalListCache } from "./professionals.js";
import {
  optionalString,
  parseBoolean,
  parsePagination,
  parsePositiveInteger,
  parsePositiveMoney,
  requiredString
} from "../utils/validation.js";

const router = Router();
const APPOINTMENTS_CACHE_TTL_MS = Math.max(5_000, Number(process.env.APPOINTMENTS_CACHE_TTL_MS || 10_000));
const APPOINTMENTS_CACHE_MAX_ITEMS = Math.max(100, Number(process.env.APPOINTMENTS_CACHE_MAX_ITEMS || 300));
const appointmentsCache = new Map();

const clientSelect = {
  id: true,
  name: true,
  phone: true,
  notes: true,
  responsavelTelefone: true,
  responsavel: { select: { id: true, name: true, phone: true } },
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
  kind: true,
  title: true,
  clientId: true,
  serviceId: true,
  professionalId: true,
  monthlyPlanId: true,
  startsAt: true,
  endsAt: true,
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

function appointmentsCacheKey(req, suffix = "list") {
  return JSON.stringify({
    suffix,
    workspaceId: req.workspaceId || "",
    userId: req.user?.id || "",
    role: req.user?.workspaceRole || req.user?.workspaceMember?.role || "",
    professionalId: req.user?.professionalId || "",
    query: req.query || {}
  });
}

function getCachedAppointments(key) {
  const cached = appointmentsCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    appointmentsCache.delete(key);
    return null;
  }
  return cached.value;
}

function setAppointmentsCache(key, value) {
  if (appointmentsCache.size >= APPOINTMENTS_CACHE_MAX_ITEMS) {
    const oldestKey = appointmentsCache.keys().next().value;
    if (oldestKey) appointmentsCache.delete(oldestKey);
  }
  appointmentsCache.set(key, {
    value,
    expiresAt: Date.now() + APPOINTMENTS_CACHE_TTL_MS
  });
}

function clearAppointmentReadCaches() {
  appointmentsCache.clear();
  clearProfessionalListCache();
}

async function findAppointmentOrFail(user, id) {
  const scope = isWorkspaceProfessional(user)
    ? { professionalId: user.professionalId || "__missing_professional__" }
    : {};
  const appointment = await prisma.appointment.findFirst({
    where: { ...workspaceWhere(user), id, ...scope },
    select: appointmentSelect
  });

  if (!appointment) {
    throw new ApiError(404, "Agendamento não encontrado.");
  }

  return appointment;
}

async function findClientOrFail(req, clientId) {
  const client = await prisma.client.findFirst({
    where: clientAccessWhere(req, { id: clientId }),
    select: { id: true }
  });
  if (!client) {
    throw new ApiError(400, "Cliente inválido para este usuário.");
  }
  return client;
}

async function findServiceOrFail(user, serviceId) {
  const service = await prisma.service.findFirst({
    where: workspaceWhere(user, { id: serviceId }),
    select: {
      id: true,
      priceDefault: true,
      durationMinutes: true,
      isActive: true
    }
  });
  if (!service) {
    throw new ApiError(400, "Serviço inválido para este usuário.");
  }
  return service;
}

async function findProfessionalOrFail(user, professionalId) {
  if (!professionalId) return null;

  const professional = await prisma.professional.findFirst({
    where: workspaceWhere(user, { id: professionalId }),
    select: { id: true, isActive: true }
  });
  if (!professional) {
    throw new ApiError(400, "Profissional inválido para este usuário.");
  }
  return professional;
}

async function assertNoConflict({ user, startsAt, endsAt, appointmentId = null, professionalId = null, confirmConflict = false }) {
  const conflict = await prisma.appointment.findFirst({
    where: {
      ...workspaceWhere(user),
      ...(appointmentId ? { id: { not: appointmentId } } : {}),
      ...(professionalId ? { professionalId } : {}),
      status: { not: "CANCELED" },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt }
    },
    select: {
      id: true,
      kind: true,
      title: true,
      clientId: true,
      serviceId: true,
      professionalId: true,
      monthlyPlanId: true,
      startsAt: true,
      endsAt: true,
      price: true,
      notes: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      client: { select: { name: true } },
      service: { select: { id: true, name: true, priceDefault: true, durationMinutes: true, isActive: true } },
      professional: { select: { name: true } },
      monthlyPlan: { select: { id: true, planName: true, billingType: true, status: true } }
    }
  });

  if (conflict) {
    if (confirmConflict) return conflict;

    const publicConflict = publicAppointment(conflict);
    const professionalText = conflict.professional ? ` com ${conflict.professional.name}` : "";
    const conflictLabel = conflict.client?.name || conflict.title || "um compromisso pessoal";
    throw new ApiError(
      409,
      `Conflito de horário${professionalText}: ${conflictLabel} às ${publicConflict.startTime}.`,
      {
        code: "APPOINTMENT_CONFLICT",
        conflict: {
          id: publicConflict.id,
          date: publicConflict.date,
          startTime: publicConflict.startTime,
          endTime: publicConflict.endTime,
          kind: publicConflict.kind,
          clientName: conflict.client?.name || "",
          serviceName: conflict.service?.name || "",
          title: conflict.title || "",
          professionalName: conflict.professional?.name || ""
        }
      }
    );
  }

  return null;
}

async function buildWhereFromQuery(req, query) {
  const user = req.user;
  const canFilterProfessionals =
    isWorkspaceProfessional(user) || planHasFeature(user, PLAN_FEATURES.PROFESSIONAL_FILTERS);
  const scope = await resolveProfessionalScope(
    prisma,
    user,
    canFilterProfessionals ? query.professionalId : ""
  );
  const where = { ...workspaceWhere(req), ...professionalWhere(scope) };
  const range = dateRangeFromQuery(query);

  if (range) {
    where.startsAt = range;
  }

  if (query.clientId) {
    where.clientId = String(query.clientId);
  }

  if (query.status) {
    where.status = normalizeStatus(query.status);
  }

  return where;
}

async function listAppointmentBootstrap(req) {
  const professionalListWhere = workspaceWhere(req);
  if (isWorkspaceProfessional(req.user)) {
    professionalListWhere.id = req.user.professionalId || "__missing_professional__";
  }

  const [clients, professionals, services] = await Promise.all([
    prisma.client.findMany({
      where: clientAccessWhere(req),
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: 500
    }),
    prisma.professional.findMany({
      where: professionalListWhere,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: 300
    }),
    prisma.service.findMany({
      where: isWorkspaceProfessional(req.user) ? { ...workspaceWhere(req), isActive: true } : workspaceWhere(req),
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: 300
    })
  ]);

  return {
    clients: clients.map(publicClient),
    professionals: professionals.map(publicProfessional),
    services: services.map(publicService)
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const cacheKey = appointmentsCacheKey(req);
    const cached = getCachedAppointments(cacheKey);
    if (cached) return res.json(cached);

    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });
    const where = await buildWhereFromQuery(req, req.query);

    const appointments = await prisma.appointment.findMany({
      where,
      ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : {}),
      select: appointmentSelect,
      orderBy: [{ startsAt: "asc" }]
    });

    const payload = { appointments: appointments.map(publicAppointment) };
    setAppointmentsCache(cacheKey, payload);
    res.json(payload);
  })
);

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const cacheKey = appointmentsCacheKey(req, "overview");
    const cached = getCachedAppointments(cacheKey);
    if (cached) return res.json(cached);

    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });
    const where = await buildWhereFromQuery(req, req.query);

    const [appointments, bootstrap] = await Promise.all([
      prisma.appointment.findMany({
        where,
        ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : {}),
        select: appointmentSelect,
        orderBy: [{ startsAt: "asc" }]
      }),
      req.query.includeBootstrap === "false" ? Promise.resolve(null) : listAppointmentBootstrap(req)
    ]);

    const payload = {
      appointments: appointments.map(publicAppointment),
      ...(bootstrap ? { bootstrap } : {})
    };
    setAppointmentsCache(cacheKey, payload);
    res.json(payload);
  })
);

function normalizeAppointmentKind(value) {
  return String(value || "APPOINTMENT").toUpperCase() === "PERSONAL_BLOCK" ? "PERSONAL_BLOCK" : "APPOINTMENT";
}

async function createPersonalBlock(req, res) {
  const title = requiredString(req.body.title, "título");
  const requestedProfessionalId = isWorkspaceProfessional(req.user)
    ? req.user.professionalId
    : requiredString(req.body.professionalId, "profissional");
  const professionalScope = await resolveProfessionalScope(prisma, req.user, requestedProfessionalId);
  const professionalId = professionalScope.professionalId;
  const date = requiredString(req.body.date, "data");
  const startTime = requiredString(req.body.startTime, "hora inicial");
  const notes = optionalString(req.body.notes);
  const durationMinutes = parsePositiveInteger(req.body.durationMinutes, "duração");
  const confirmConflict = parseBoolean(req.body.confirmConflict, false);
  const status = normalizeStatus(req.body.status, "SCHEDULED");

  if (!["SCHEDULED", "CANCELED"].includes(status)) {
    throw new ApiError(400, "Compromissos pessoais só podem ficar agendados ou cancelados.");
  }

  const professional = await findProfessionalOrFail(req.user, professionalId);
  if (professional && !professional.isActive) {
    throw new ApiError(400, "Profissionais inativos não podem ser usados em novos agendamentos.");
  }

  const startsAt = combineDateAndTime(date, startTime);
  const endsAt = addMinutes(startsAt, durationMinutes);

  if (status !== "CANCELED") {
    await assertNoConflict({ user: req.user, startsAt, endsAt, professionalId, confirmConflict });
  }

  const appointment = await prisma.appointment.create({
    data: {
      workspaceId: req.workspaceId || null,
      userId: req.user.id,
      kind: "PERSONAL_BLOCK",
      title,
      professionalId,
      startsAt,
      endsAt,
      price: 0,
      notes,
      status
    },
    select: appointmentSelect
  });

  clearAppointmentReadCaches();
  res.status(201).json({ appointment: publicAppointment(appointment) });
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (normalizeAppointmentKind(req.body.kind) === "PERSONAL_BLOCK") {
      await createPersonalBlock(req, res);
      return;
    }

    const clientId = requiredString(req.body.clientId, "cliente");
    const serviceId = requiredString(req.body.serviceId, "serviço");
    const requestedProfessionalId = isWorkspaceProfessional(req.user)
      ? req.user.professionalId
      : requiredString(req.body.professionalId, "profissional");
    const professionalScope = await resolveProfessionalScope(prisma, req.user, requestedProfessionalId);
    const professionalId = professionalScope.professionalId;
    const date = requiredString(req.body.date, "data");
    const startTime = requiredString(req.body.startTime, "hora inicial");
    const status = normalizeStatus(req.body.status, "SCHEDULED");
    const notes = optionalString(req.body.notes);
    const durationMinutes =
      req.body.durationMinutes === undefined || req.body.durationMinutes === null || req.body.durationMinutes === ""
        ? null
        : parsePositiveInteger(req.body.durationMinutes, "duração");
    const confirmConflict = parseBoolean(req.body.confirmConflict, false);

    const [, service, professional] = await Promise.all([
      findClientOrFail(req, clientId),
      findServiceOrFail(req.user, serviceId),
      findProfessionalOrFail(req.user, professionalId)
    ]);

    if (!service.isActive) {
      throw new ApiError(400, "Serviços inativos não podem ser usados em novos agendamentos.");
    }

    if (professional && !professional.isActive) {
      throw new ApiError(400, "Profissionais inativos não podem ser usados em novos agendamentos.");
    }

    const startsAt = combineDateAndTime(date, startTime);
    const effectiveDurationMinutes = durationMinutes || service.durationMinutes;
    const endsAt = addMinutes(startsAt, effectiveDurationMinutes);
    const price =
      req.body.price === undefined || req.body.price === null || req.body.price === ""
        ? Number(service.priceDefault)
        : parsePositiveMoney(req.body.price, "valor");

    if (status !== "CANCELED") {
      await assertNoConflict({ user: req.user, startsAt, endsAt, professionalId, confirmConflict });
    }

    const appointment = await prisma.appointment.create({
      data: {
        workspaceId: req.workspaceId || null,
        userId: req.user.id,
        clientId,
        serviceId,
        professionalId,
        startsAt,
        endsAt,
        price,
        notes,
        status
      },
      select: appointmentSelect
    });

    await syncAppointmentReminders(appointment);

    clearAppointmentReadCaches();
    res.status(201).json({ appointment: publicAppointment(appointment) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const appointment = await findAppointmentOrFail(req.user, req.params.id);
    res.json({ appointment: publicAppointment(appointment) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const current = await findAppointmentOrFail(req.user, req.params.id);
    const currentPublic = publicAppointment(current);

    if (current.kind === "PERSONAL_BLOCK") {
      const title = req.body.title === undefined ? current.title || "" : requiredString(req.body.title, "título");
      const requestedProfessionalId =
        req.body.professionalId === undefined
          ? current.professionalId
          : req.body.professionalId
          ? requiredString(req.body.professionalId, "profissional")
          : null;
      const professionalId = isWorkspaceProfessional(req.user) ? req.user.professionalId : requestedProfessionalId;

      if (!professionalId) {
        throw new ApiError(400, "Profissional obrigatorio para este agendamento.");
      }

      await assertProfessionalBelongsToUser(prisma, req.user, professionalId);
      const date = req.body.date === undefined ? currentPublic.date : requiredString(req.body.date, "data");
      const startTime =
        req.body.startTime === undefined
          ? currentPublic.startTime
          : requiredString(req.body.startTime, "hora inicial");
      const status = normalizeStatus(req.body.status, current.status);
      if (!["SCHEDULED", "CANCELED"].includes(status)) {
        throw new ApiError(400, "Compromissos pessoais só podem ficar agendados ou cancelados.");
      }
      const notes = req.body.notes === undefined ? current.notes || "" : optionalString(req.body.notes);
      const durationMinutes =
        req.body.durationMinutes === undefined || req.body.durationMinutes === null || req.body.durationMinutes === ""
          ? currentPublic.durationMinutes || null
          : parsePositiveInteger(req.body.durationMinutes, "duração");
      const confirmConflict = parseBoolean(req.body.confirmConflict, false);
      const timeChanged =
        req.body.date !== undefined || req.body.startTime !== undefined || req.body.durationMinutes !== undefined;

      const professional = await findProfessionalOrFail(req.user, professionalId);
      if (professionalId !== current.professionalId && professional && !professional.isActive) {
        throw new ApiError(400, "Profissionais inativos não podem ser usados em novos agendamentos.");
      }

      const startsAt = timeChanged ? combineDateAndTime(date, startTime) : current.startsAt;
      const effectiveDurationMinutes = durationMinutes || Math.round((current.endsAt - current.startsAt) / 60000);
      const endsAt = timeChanged ? addMinutes(startsAt, effectiveDurationMinutes) : current.endsAt;

      const shouldCheckConflict =
        status !== "CANCELED" &&
        (timeChanged || professionalId !== current.professionalId || current.status === "CANCELED");

      if (shouldCheckConflict) {
        await assertNoConflict({
          user: req.user,
          startsAt,
          endsAt,
          appointmentId: req.params.id,
          professionalId,
          confirmConflict
        });
      }

      const appointment = await prisma.appointment.update({
        where: { id: req.params.id },
        data: { title, professionalId, startsAt, endsAt, notes, status },
        select: appointmentSelect
      });

      clearAppointmentReadCaches();
      res.json({ appointment: publicAppointment(appointment) });
      return;
    }

    const clientId =
      req.body.clientId === undefined ? current.clientId : requiredString(req.body.clientId, "cliente");
    const serviceId =
      req.body.serviceId === undefined ? current.serviceId : requiredString(req.body.serviceId, "serviço");
    const requestedProfessionalId =
      req.body.professionalId === undefined
        ? current.professionalId
        : req.body.professionalId
        ? requiredString(req.body.professionalId, "profissional")
        : null;
    const professionalId = isWorkspaceProfessional(req.user)
      ? req.user.professionalId
      : requestedProfessionalId;

    if (!professionalId) {
      throw new ApiError(400, "Profissional obrigatorio para este agendamento.");
    }

    await assertProfessionalBelongsToUser(prisma, req.user, professionalId);
    const date = req.body.date === undefined ? currentPublic.date : requiredString(req.body.date, "data");
    const startTime =
      req.body.startTime === undefined
        ? currentPublic.startTime
        : requiredString(req.body.startTime, "hora inicial");
    const status = normalizeStatus(req.body.status, current.status);
    const notes = req.body.notes === undefined ? current.notes || "" : optionalString(req.body.notes);
    const durationMinutes =
      req.body.durationMinutes === undefined || req.body.durationMinutes === null || req.body.durationMinutes === ""
        ? currentPublic.durationMinutes || null
        : parsePositiveInteger(req.body.durationMinutes, "duração");
    const confirmConflict = parseBoolean(req.body.confirmConflict, false);
    const timeChanged =
      req.body.date !== undefined ||
      req.body.startTime !== undefined ||
      req.body.serviceId !== undefined ||
      req.body.durationMinutes !== undefined;

    const [, service, professional] = await Promise.all([
      findClientOrFail(req, clientId),
      findServiceOrFail(req.user, serviceId),
      findProfessionalOrFail(req.user, professionalId)
    ]);

    if (serviceId !== current.serviceId && !service.isActive) {
      throw new ApiError(400, "Serviços inativos não podem ser usados em novos agendamentos.");
    }

    if (professionalId !== current.professionalId && professional && !professional.isActive) {
      throw new ApiError(400, "Profissionais inativos não podem ser usados em novos agendamentos.");
    }

    const startsAt = timeChanged ? combineDateAndTime(date, startTime) : current.startsAt;
    const effectiveDurationMinutes = durationMinutes || service.durationMinutes;
    const endsAt = timeChanged ? addMinutes(startsAt, effectiveDurationMinutes) : current.endsAt;
    const price =
      req.body.price === undefined || req.body.price === null || req.body.price === ""
        ? serviceId !== current.serviceId
          ? Number(service.priceDefault)
          : Number(current.price)
        : parsePositiveMoney(req.body.price, "valor");

    const shouldCheckConflict =
      status !== "CANCELED" &&
      (timeChanged || professionalId !== current.professionalId || current.status === "CANCELED");

    if (shouldCheckConflict) {
      await assertNoConflict({
        user: req.user,
        startsAt,
        endsAt,
        appointmentId: req.params.id,
        professionalId,
        confirmConflict
      });
    }

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { clientId, serviceId, professionalId, startsAt, endsAt, price, notes, status },
      select: appointmentSelect
    });

    await syncAppointmentReminders(appointment);

    clearAppointmentReadCaches();
    res.json({ appointment: publicAppointment(appointment) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await findAppointmentOrFail(req.user, req.params.id);
    await prisma.appointment.delete({ where: { id: req.params.id } });
    clearAppointmentReadCaches();
    res.status(204).send();
  })
);

export default router;
