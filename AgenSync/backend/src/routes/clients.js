import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { publicClient, publicClientCareRecord } from "../utils/formatters.js";
import { optionalString, requiredString } from "../utils/validation.js";

const router = Router();

async function findClientOrFail(userId, id) {
  const client = await prisma.client.findFirst({ where: { id, userId } });
  if (!client) {
    throw new ApiError(404, "Cliente não encontrado.");
  }
  return client;
}

function jsonObject(value, fallback) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return value;
}

function jsonArray(value) {
  return Array.isArray(value) ? value : [];
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const clients = await prisma.client.findMany({
      where: { userId: req.user.id },
      orderBy: [{ name: "asc" }]
    });

    res.json({ clients: clients.map(publicClient) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const name = requiredString(req.body.name, "nome", 2);
    const phone = requiredString(req.body.phone, "telefone", 8);
    const notes = optionalString(req.body.notes);

    const client = await prisma.client.create({
      data: { userId: req.user.id, name, phone, notes }
    });

    res.status(201).json({ client: publicClient(client) });
  })
);

router.get(
  "/:id/care-record",
  asyncHandler(async (req, res) => {
    await findClientOrFail(req.user.id, req.params.id);

    const record = await prisma.clientCareRecord.findUnique({
      where: { clientId: req.params.id }
    });

    res.json({ care: publicClientCareRecord(record) });
  })
);

router.put(
  "/:id/care-record",
  asyncHandler(async (req, res) => {
    await findClientOrFail(req.user.id, req.params.id);

    const payload = {
      anamnesis: jsonObject(req.body.anamnesis, {}),
      documents: jsonArray(req.body.documents),
      budgets: jsonArray(req.body.budgets),
      forms: jsonArray(req.body.forms),
      photos: jsonArray(req.body.photos),
      evolutions: jsonArray(req.body.evolutions)
    };

    const record = await prisma.clientCareRecord.upsert({
      where: { clientId: req.params.id },
      create: {
        clientId: req.params.id,
        ...payload
      },
      update: payload
    });

    res.json({ care: publicClientCareRecord(record) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const client = await findClientOrFail(req.user.id, req.params.id);
    res.json({ client: publicClient(client) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    await findClientOrFail(req.user.id, req.params.id);

    const name = requiredString(req.body.name, "nome", 2);
    const phone = requiredString(req.body.phone, "telefone", 8);
    const notes = optionalString(req.body.notes);

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { name, phone, notes }
    });

    res.json({ client: publicClient(client) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await findClientOrFail(req.user.id, req.params.id);

    const appointments = await prisma.appointment.count({
      where: { userId: req.user.id, clientId: req.params.id }
    });

    if (appointments > 0) {
      throw new ApiError(409, "Não é possível excluir cliente com agendamentos vinculados.");
    }

    await prisma.client.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
