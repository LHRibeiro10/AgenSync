import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { publicProfessional } from "../utils/formatters.js";
import { optionalString, parseBoolean, requiredString } from "../utils/validation.js";

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
    if (req.query.active === "true") {
      where.isActive = true;
    }

    const professionals = await prisma.professional.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });

    res.json({ professionals: professionals.map(publicProfessional) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const name = requiredString(req.body.name, "nome", 2);
    const role = optionalString(req.body.role);
    const phone = optionalString(req.body.phone);
    const isActive = parseBoolean(req.body.isActive, true);

    const professional = await prisma.professional.create({
      data: { userId: req.user.id, name, role, phone, isActive }
    });

    res.status(201).json({ professional: publicProfessional(professional) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const professional = await findProfessionalOrFail(req.user.id, req.params.id);
    res.json({ professional: publicProfessional(professional) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    await findProfessionalOrFail(req.user.id, req.params.id);

    const name = requiredString(req.body.name, "nome", 2);
    const role = optionalString(req.body.role);
    const phone = optionalString(req.body.phone);
    const isActive = parseBoolean(req.body.isActive, true);

    const professional = await prisma.professional.update({
      where: { id: req.params.id },
      data: { name, role, phone, isActive }
    });

    res.json({ professional: publicProfessional(professional) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
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
