import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { publicProfessional } from "../utils/formatters.js";
import {
  assertCanCreateProfessional,
  isWorkspaceProfessional,
  requireWorkspaceManager
} from "../utils/accessControl.js";
import {
  optionalEmail,
  optionalString,
  parseBoolean,
  parsePagination,
  parsePositiveMoney,
  requiredString
} from "../utils/validation.js";

const router = Router();

async function findProfessionalOrFail(userId, id) {
  const professional = await prisma.professional.findFirst({ where: { id, userId } });
  if (!professional) {
    throw new ApiError(404, "Profissional não encontrado.");
  }
  return professional;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where = { userId: req.user.id };
    if (isWorkspaceProfessional(req.user)) {
      if (!req.user.professionalId) {
        throw new ApiError(403, "Usuario profissional sem profissional vinculado.");
      }
      where.id = req.user.professionalId;
    }
    if (req.query.active === "true") {
      where.isActive = true;
    }
    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });

    const professionals = await prisma.professional.findMany({
      where,
      ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : {}),
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });

    res.json({ professionals: professionals.map(publicProfessional) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const name = requiredString(req.body.name, "nome", 2);
    const role = optionalString(req.body.role);
    const email = optionalEmail(req.body.email);
    const phone = optionalString(req.body.phone);
    const monthlyGoal =
      req.body.monthlyGoal === undefined || req.body.monthlyGoal === null || req.body.monthlyGoal === ""
        ? null
        : parsePositiveMoney(req.body.monthlyGoal, "meta mensal");
    const isActive = parseBoolean(req.body.isActive, true);

    await assertCanCreateProfessional(prisma, req.user, { active: isActive });

    const professional = await prisma.professional.create({
      data: { userId: req.user.id, name, role, email, phone, monthlyGoal, isActive }
    });

    res.status(201).json({ professional: publicProfessional(professional) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (isWorkspaceProfessional(req.user) && req.params.id !== req.user.professionalId) {
      throw new ApiError(403, "Voce so pode acessar seu proprio perfil profissional.");
    }
    const professional = await findProfessionalOrFail(req.user.id, req.params.id);
    res.json({ professional: publicProfessional(professional) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    await findProfessionalOrFail(req.user.id, req.params.id);

    const name = requiredString(req.body.name, "nome", 2);
    const role = optionalString(req.body.role);
    const email = optionalEmail(req.body.email);
    const phone = optionalString(req.body.phone);
    const monthlyGoal =
      req.body.monthlyGoal === undefined || req.body.monthlyGoal === null || req.body.monthlyGoal === ""
        ? null
        : parsePositiveMoney(req.body.monthlyGoal, "meta mensal");
    const isActive = parseBoolean(req.body.isActive, true);

    await assertCanCreateProfessional(prisma, req.user, {
      excludeProfessionalId: req.params.id,
      active: isActive
    });

    const professional = await prisma.professional.update({
      where: { id: req.params.id },
      data: { name, role, email, phone, monthlyGoal, isActive }
    });

    res.json({ professional: publicProfessional(professional) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    await findProfessionalOrFail(req.user.id, req.params.id);

    const appointments = await prisma.appointment.count({
      where: { userId: req.user.id, professionalId: req.params.id }
    });

    if (appointments > 0) {
      throw new ApiError(409, "Não é possível excluir profissional com agendamentos. Desative-o para ocultar na criação.");
    }

    await prisma.professional.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
