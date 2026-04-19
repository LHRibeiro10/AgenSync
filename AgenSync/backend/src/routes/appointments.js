import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { addMinutes, combineDateAndTime, dateRangeFromQuery } from "../utils/dates.js";
import { normalizeStatus, publicAppointment } from "../utils/formatters.js";
import { optionalString, parsePositiveMoney, requiredString } from "../utils/validation.js";

const router = Router();

const appointmentInclude = {
  client: true,
  service: true,
  professional: true
};

async function findAppointmentOrFail(userId, id) {
  const appointment = await prisma.appointment.findFirst({
    where: { id, userId },
    include: appointmentInclude
  });

  if (!appointment) {
    throw new ApiError(404, "Agendamento não encontrado.");
  }

  return appointment;
}

async function findClientOrFail(userId, clientId) {
  const client = await prisma.client.findFirst({ where: { id: clientId, userId } });
  if (!client) {
    throw new ApiError(400, "Cliente inválido para este usuário.");
  }
  return client;
}

async function findServiceOrFail(userId, serviceId) {
  const service = await prisma.service.findFirst({ where: { id: serviceId, userId } });
  if (!service) {
    throw new ApiError(400, "Serviço inválido para este usuário.");
  }
  return service;
}

async function findProfessionalOrFail(userId, professionalId) {
  if (!professionalId) return null;

  const professional = await prisma.professional.findFirst({ where: { id: professionalId, userId } });
  if (!professional) {
    throw new ApiError(400, "Profissional inválido para este usuário.");
  }
  return professional;
}

async function assertNoConflict({ userId, startsAt, endsAt, appointmentId = null, professionalId = null }) {
  const conflict = await prisma.appointment.findFirst({
    where: {
      userId,
      ...(appointmentId ? { id: { not: appointmentId } } : {}),
      ...(professionalId ? { professionalId } : {}),
      status: { not: "CANCELED" },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt }
    },
    include: appointmentInclude
  });

  if (conflict) {
    const professionalText = conflict.professional ? ` com ${conflict.professional.name}` : "";
    throw new ApiError(
      409,
      `Conflito de horário${professionalText}: ${conflict.client.name} às ${publicAppointment(conflict).startTime}.`
    );
  }
}

function buildWhereFromQuery(userId, query) {
  const where = { userId };
  const range = dateRangeFromQuery(query);

  if (range) {
    where.startsAt = range;
  }

  if (query.clientId) {
    where.clientId = String(query.clientId);
  }

  if (query.professionalId) {
    where.professionalId = String(query.professionalId);
  }

  if (query.status) {
    where.status = normalizeStatus(query.status);
  }

  return where;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const appointments = await prisma.appointment.findMany({
      where: buildWhereFromQuery(req.user.id, req.query),
      include: appointmentInclude,
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
    const professionalId = requiredString(req.body.professionalId, "profissional");
    const date = requiredString(req.body.date, "data");
    const startTime = requiredString(req.body.startTime, "hora inicial");
    const status = normalizeStatus(req.body.status, "SCHEDULED");
    const notes = optionalString(req.body.notes);

    await findClientOrFail(req.user.id, clientId);
    const service = await findServiceOrFail(req.user.id, serviceId);
    const professional = await findProfessionalOrFail(req.user.id, professionalId);

    if (!service.isActive) {
      throw new ApiError(400, "Serviços inativos não podem ser usados em novos agendamentos.");
    }

    if (professional && !professional.isActive) {
      throw new ApiError(400, "Profissionais inativos não podem ser usados em novos agendamentos.");
    }

    const startsAt = combineDateAndTime(date, startTime);
    const endsAt = addMinutes(startsAt, service.durationMinutes);
    const price =
      req.body.price === undefined || req.body.price === null || req.body.price === ""
        ? Number(service.priceDefault)
        : parsePositiveMoney(req.body.price, "valor");

    if (status !== "CANCELED") {
      await assertNoConflict({ userId: req.user.id, startsAt, endsAt, professionalId });
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
      include: appointmentInclude
    });

    res.status(201).json({ appointment: publicAppointment(appointment) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const appointment = await findAppointmentOrFail(req.user.id, req.params.id);
    res.json({ appointment: publicAppointment(appointment) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const current = await findAppointmentOrFail(req.user.id, req.params.id);
    const currentPublic = publicAppointment(current);

    const clientId =
      req.body.clientId === undefined ? current.clientId : requiredString(req.body.clientId, "cliente");
    const serviceId =
      req.body.serviceId === undefined ? current.serviceId : requiredString(req.body.serviceId, "serviço");
    const professionalId =
      req.body.professionalId === undefined
        ? current.professionalId
        : req.body.professionalId
        ? requiredString(req.body.professionalId, "profissional")
        : null;
    const date = req.body.date === undefined ? currentPublic.date : requiredString(req.body.date, "data");
    const startTime =
      req.body.startTime === undefined
        ? currentPublic.startTime
        : requiredString(req.body.startTime, "hora inicial");
    const status = normalizeStatus(req.body.status, current.status);
    const notes = req.body.notes === undefined ? current.notes || "" : optionalString(req.body.notes);
    const timeChanged =
      req.body.date !== undefined || req.body.startTime !== undefined || req.body.serviceId !== undefined;

    await findClientOrFail(req.user.id, clientId);
    const service = await findServiceOrFail(req.user.id, serviceId);
    const professional = await findProfessionalOrFail(req.user.id, professionalId);

    if (serviceId !== current.serviceId && !service.isActive) {
      throw new ApiError(400, "Serviços inativos não podem ser usados em novos agendamentos.");
    }

    if (professionalId !== current.professionalId && professional && !professional.isActive) {
      throw new ApiError(400, "Profissionais inativos não podem ser usados em novos agendamentos.");
    }

    const startsAt = timeChanged ? combineDateAndTime(date, startTime) : current.startsAt;
    const endsAt = timeChanged ? addMinutes(startsAt, service.durationMinutes) : current.endsAt;
    const price =
      req.body.price === undefined || req.body.price === null || req.body.price === ""
        ? serviceId !== current.serviceId
          ? Number(service.priceDefault)
          : Number(current.price)
        : parsePositiveMoney(req.body.price, "valor");

    if (status !== "CANCELED") {
      await assertNoConflict({
        userId: req.user.id,
        startsAt,
        endsAt,
        appointmentId: req.params.id,
        professionalId
      });
    }

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { clientId, serviceId, professionalId, startsAt, endsAt, price, notes, status },
      include: appointmentInclude
    });

    res.json({ appointment: publicAppointment(appointment) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await findAppointmentOrFail(req.user.id, req.params.id);
    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
