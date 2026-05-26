import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { isWorkspaceProfessional, requireWorkspacePermission, workspaceWhere } from "../utils/accessControl.js";
import { publicService } from "../utils/formatters.js";
import {
  parseBoolean,
  parsePagination,
  parsePositiveInteger,
  parsePositiveMoney,
  requiredString
} from "../utils/validation.js";

const router = Router();

async function findServiceOrFail(req, id) {
  const service = await prisma.service.findFirst({ where: workspaceWhere(req, { id }) });
  if (!service) {
    throw new ApiError(404, "Serviço não encontrado.");
  }
  return service;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where = workspaceWhere(req);
    if (req.query.active === "true" || isWorkspaceProfessional(req.user)) {
      where.isActive = true;
    }
    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });

    const services = await prisma.service.findMany({
      where,
      ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : {}),
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });

    res.json({ services: services.map(publicService) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    requireWorkspacePermission("canManageServices")(req, res, () => {});
    const name = requiredString(req.body.name, "nome", 2);
    const priceDefault = parsePositiveMoney(req.body.priceDefault, "preço padrão");
    const durationMinutes = parsePositiveInteger(req.body.durationMinutes, "duração");
    const isActive = parseBoolean(req.body.isActive, true);

    const service = await prisma.service.create({
      data: { workspaceId: req.workspaceId || null, userId: req.user.id, name, priceDefault, durationMinutes, isActive }
    });

    res.status(201).json({ service: publicService(service) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const service = await findServiceOrFail(req, req.params.id);
    if (isWorkspaceProfessional(req.user) && !service.isActive) {
      throw new ApiError(404, "Servico nao encontrado.");
    }
    res.json({ service: publicService(service) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    requireWorkspacePermission("canManageServices")(req, res, () => {});
    await findServiceOrFail(req, req.params.id);

    const name = requiredString(req.body.name, "nome", 2);
    const priceDefault = parsePositiveMoney(req.body.priceDefault, "preço padrão");
    const durationMinutes = parsePositiveInteger(req.body.durationMinutes, "duração");
    const isActive = parseBoolean(req.body.isActive, true);

    const service = await prisma.service.update({
      where: { id: req.params.id },
      data: { name, priceDefault, durationMinutes, isActive }
    });

    res.json({ service: publicService(service) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    requireWorkspacePermission("canManageServices")(req, res, () => {});
    await findServiceOrFail(req, req.params.id);

    const appointments = await prisma.appointment.count({
      where: workspaceWhere(req, { serviceId: req.params.id })
    });

    if (appointments > 0) {
      throw new ApiError(409, "Não é possível excluir serviço com agendamentos. Desative-o para ocultar na criação.");
    }

    await prisma.service.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
