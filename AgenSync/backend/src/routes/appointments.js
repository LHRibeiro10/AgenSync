import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { PLAN_FEATURES, planHasFeature } from "../config/plans.js";
import { addMinutes, combineDateAndTime, dateRangeFromQuery } from "../utils/dates.js";
import {
  assertProfessionalBelongsToUser,
  isWorkspaceProfessional,
  professionalWhere,
  resolveProfessionalScope
} from "../utils/accessControl.js";
import { normalizeStatus, publicAppointment } from "../utils/formatters.js";
import { syncAppointmentReminders } from "../services/appointmentReminderService.js";
import {
  optionalString,
  parseBoolean,
  parsePagination,
  parsePositiveInteger,
  parsePositiveMoney,
  requiredString
} from "../utils/validation.js";

const router = Router();

const clientSelect = {
  id: true,
  name: true,
  phone: true,
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
  userId: true,
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

async function findAppointmentOrFail(user, id) {
  const scope = isWorkspaceProfessional(user)
    ? { professionalId: user.professionalId || "__missing_professional__" }
    : {};
  const appointment = await prisma.appointment.findFirst({
    where: { id, userId: user.id, ...scope },
    select: appointmentSelect
  });

  if (!appointment) {
    throw new ApiError(404, "Agendamento não encontrado.");
  }

  return appointment;
}

async function findClientOrFail(userId, clientId) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId },
    select: { id: true }
  });
  if (!client) {
    throw new ApiError(400, "Cliente inválido para este usuário.");
  }
  return client;
}

async function findServiceOrFail(userId, serviceId) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, userId },
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

async function findProfessionalOrFail(userId, professionalId) {
  if (!professionalId) return null;

  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, userId },
    select: { id: true, isActive: true }
  });
  if (!professional) {
    throw new ApiError(400, "Profissional inválido para este usuário.");
  }
  return professional;
}

async function assertNoConflict({ userId, startsAt, endsAt, appointmentId = null, professionalId = null, confirmConflict = false }) {
  const conflict = await prisma.appointment.findFirst({
    where: {
      userId,
      ...(appointmentId ? { id: { not: appointmentId } } : {}),
      ...(professionalId ? { professionalId } : {}),
      status: { not: "CANCELED" },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt }
    },
    select: {
      id: true,
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
    throw new ApiError(
      409,
      `Conflito de horário${professionalText}: ${conflict.client.name} às ${publicConflict.startTime}.`,
      {
        code: "APPOINTMENT_CONFLICT",
        conflict: {
          id: publicConflict.id,
          date: publicConflict.date,
          startTime: publicConflict.startTime,
          endTime: publicConflict.endTime,
          clientName: conflict.client?.name || "",
          serviceName: conflict.service?.name || "",
          professionalName: conflict.professional?.name || ""
        }
      }
    );
  }

  return null;
}

async function buildWhereFromQuery(user, query) {
  const canFilterProfessionals =
    isWorkspaceProfessional(user) || planHasFeature(user, PLAN_FEATURES.PROFESSIONAL_FILTERS);
  const scope = await resolveProfessionalScope(
    prisma,
    user,
    canFilterProfessionals ? query.professionalId : ""
  );
  const where = { userId: user.id, ...professionalWhere(scope) };
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

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });
    const where = await buildWhereFromQuery(req.user, req.query);

    const appointments = await prisma.appointment.findMany({
      where,
      ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : {}),
      select: appointmentSelect,
      orderBy: [{ startsAt: "asc" }]
    });

    res.json({ appointments: appointments.map(publicAppointment) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
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
      findClientOrFail(req.user.id, clientId),
      findServiceOrFail(req.user.id, serviceId),
      findProfessionalOrFail(req.user.id, professionalId)
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
      await assertNoConflict({ userId: req.user.id, startsAt, endsAt, professionalId, confirmConflict });
    }

    const appointment = await prisma.appointment.create({
      data: {
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

    await assertProfessionalBelongsToUser(prisma, req.user.id, professionalId);
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
      findClientOrFail(req.user.id, clientId),
      findServiceOrFail(req.user.id, serviceId),
      findProfessionalOrFail(req.user.id, professionalId)
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
        userId: req.user.id,
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

    res.json({ appointment: publicAppointment(appointment) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await findAppointmentOrFail(req.user, req.params.id);
    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
