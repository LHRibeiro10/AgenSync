import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { clientAccessWhere, requireWorkspacePermission, workspaceWhere } from "../utils/accessControl.js";
import { publicClient, publicClientCareRecord, publicProduct, publicService } from "../utils/formatters.js";
import { optionalEmail, optionalString, parsePagination, requiredString } from "../utils/validation.js";

const router = Router();
const CLIENT_LIST_CACHE_TTL_MS = Math.max(5_000, Number(process.env.CLIENT_LIST_CACHE_TTL_MS || 15_000));
const CLIENT_LIST_CACHE_MAX_ITEMS = Math.max(50, Number(process.env.CLIENT_LIST_CACHE_MAX_ITEMS || 200));
const clientListCache = new Map();

function clientListCacheKey(req, scope = "list") {
  return JSON.stringify({
    scope,
    workspaceId: req.workspaceId || "",
    userId: req.user?.id || "",
    role: req.user?.workspaceRole || req.user?.workspaceMember?.role || "",
    professionalId: req.user?.professionalId || "",
    query: req.query || {}
  });
}

function getCachedClientList(key) {
  const cached = clientListCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    clientListCache.delete(key);
    return null;
  }
  return cached.value;
}

function setClientListCache(key, value) {
  if (clientListCache.size >= CLIENT_LIST_CACHE_MAX_ITEMS) {
    const oldestKey = clientListCache.keys().next().value;
    if (oldestKey) clientListCache.delete(oldestKey);
  }
  clientListCache.set(key, {
    value,
    expiresAt: Date.now() + CLIENT_LIST_CACHE_TTL_MS
  });
}

function clearClientListCache() {
  clientListCache.clear();
}

async function findClientOrFail(req, id) {
  const client = await prisma.client.findFirst({ where: clientAccessWhere(req, { id }) });
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

function cleanString(value, maxLength = 500) {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  if (!text) return null;
  return text.slice(0, maxLength);
}

function cleanDigits(value, maxLength = 32) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? digits.slice(0, maxLength) : null;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "sim", "yes"].includes(normalized)) return true;
  if (["false", "0", "nao", "no"].includes(normalized)) return false;
  return fallback;
}

function parseImportDate(value) {
  const text = cleanString(value, 16);
  if (!text) return null;
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeImportedClient(row, index) {
  const name = cleanString(row.name, 160);
  if (!name || name.length < 2) {
    return { error: { index, message: "Nome do cliente e obrigatorio." } };
  }

  return {
    client: {
      name,
      phone: cleanDigits(row.phone, 20) || "",
      notes: cleanString(row.notes, 3000),
      cpf: cleanDigits(row.cpf, 14),
      cnpj: cleanDigits(row.cnpj, 18),
      rg: cleanString(row.rg, 40),
      birthDate: parseImportDate(row.birthDate),
      zipCode: cleanDigits(row.zipCode, 12),
      address: cleanString(row.address, 200),
      addressNumber: cleanString(row.addressNumber, 40),
      addressComplement: cleanString(row.addressComplement, 120),
      district: cleanString(row.district, 120),
      state: cleanString(row.state, 2)?.toUpperCase() || null,
      city: cleanString(row.city, 120),
      tags: cleanString(row.tags, 500),
      source: cleanString(row.source, 120),
      externalId: cleanString(row.externalId, 80)
    }
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const cacheKey = clientListCacheKey(req);
    const cached = getCachedClientList(cacheKey);
    if (cached) return res.json(cached);

    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });

    const includeInactive = parseBoolean(req.query.includeInactive);
    const clients = await prisma.client.findMany({
      where: {
        ...clientAccessWhere(req),
        ...(includeInactive ? {} : { isActive: true })
      },
      ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : {}),
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });

    const payload = { clients: clients.map(publicClient) };
    setClientListCache(cacheKey, payload);
    res.json(payload);
  })
);

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const cacheKey = clientListCacheKey(req, "overview");
    const cached = getCachedClientList(cacheKey);
    if (cached) return res.json(cached);

    const includeInactive = parseBoolean(req.query.includeInactive, true);
    const [clients, services, products] = await Promise.all([
      prisma.client.findMany({
        where: {
          ...clientAccessWhere(req),
          ...(includeInactive ? {} : { isActive: true })
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        take: 500
      }),
      prisma.service.findMany({
        where: { ...workspaceWhere(req), isActive: true },
        orderBy: [{ name: "asc" }],
        take: 300
      }),
      prisma.product.findMany({
        where: { ...workspaceWhere(req), isActive: true },
        orderBy: [{ name: "asc" }],
        take: 300
      })
    ]);

    const payload = {
      clients: clients.map(publicClient),
      bootstrap: {
        services: services.map(publicService),
        products: products.map(publicProduct)
      }
    };
    setClientListCache(cacheKey, payload);
    res.json(payload);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    requireWorkspacePermission("canManageClients")(req, res, () => {});
    const name = requiredString(req.body.name, "nome", 2);
    const phone = requiredString(req.body.phone, "telefone", 8);
    const email = optionalEmail(req.body.email);
    const notes = optionalString(req.body.notes);

    const client = await prisma.client.create({
      data: { workspaceId: req.workspaceId || null, userId: req.user.id, name, phone, email, notes }
    });

    clearClientListCache();
    res.status(201).json({ client: publicClient(client) });
  })
);

router.post(
  "/import",
  asyncHandler(async (req, res) => {
    requireWorkspacePermission("canManageClients")(req, res, () => {});
    const rows = Array.isArray(req.body.clients) ? req.body.clients : [];
    const skipDuplicates = req.body.skipDuplicates !== false;

    if (!rows.length) {
      throw new ApiError(400, "Nenhum cliente valido para importar.");
    }

    if (rows.length > 1000) {
      throw new ApiError(400, "Importe no maximo 1000 clientes por arquivo.");
    }

    const normalized = rows.map((row, index) => normalizeImportedClient(row, index));
    const errors = normalized
      .filter((item) => item.error)
      .map((item) => item.error);
    const candidates = normalized
      .filter((item) => item.client)
      .map((item) => item.client);

    const existingClients = await prisma.client.findMany({
      where: workspaceWhere(req),
      select: { id: true, name: true, phone: true, cpf: true, externalId: true }
    });

    const existingKeys = new Set(existingClients.flatMap((client) => [
      cleanDigits(client.phone) ? `phone:${cleanDigits(client.phone)}` : "",
      cleanDigits(client.cpf) ? `cpf:${cleanDigits(client.cpf)}` : "",
      client.externalId ? `external:${client.externalId}` : "",
      cleanDigits(client.phone) ? `name_phone:${client.name.toLowerCase()}_${cleanDigits(client.phone)}` : ""
    ].filter(Boolean)));

    const seenKeys = new Set();
    const duplicates = [];
    const toCreate = [];

    candidates.forEach((client, index) => {
      const keys = [
        client.phone ? `phone:${client.phone}` : "",
        client.cpf ? `cpf:${client.cpf}` : "",
        client.externalId ? `external:${client.externalId}` : "",
        client.phone ? `name_phone:${client.name.toLowerCase()}_${client.phone}` : ""
      ].filter(Boolean);

      const isDuplicate = keys.some((key) => existingKeys.has(key) || seenKeys.has(key));
      keys.forEach((key) => seenKeys.add(key));

      if (isDuplicate) {
        duplicates.push({ index, name: client.name, phone: client.phone, cpf: client.cpf });
        if (skipDuplicates) return;
      }

      toCreate.push({
        workspaceId: req.workspaceId || null,
        userId: req.user.id,
        ...client
      });
    });

    let imported = 0;
    if (toCreate.length) {
      const created = await prisma.client.createMany({ data: toCreate });
      imported = created.count;
    }

    clearClientListCache();
    res.status(201).json({
      summary: {
        totalRows: rows.length,
        imported,
        duplicatesIgnored: skipDuplicates ? duplicates.length : 0,
        duplicatesFound: duplicates.length,
        errors: errors.length
      },
      duplicates,
      errors
    });
  })
);

router.get(
  "/:id/care-record",
  asyncHandler(async (req, res) => {
    await findClientOrFail(req, req.params.id);

    const record = await prisma.clientCareRecord.findUnique({
      where: { clientId: req.params.id }
    });

    res.json({ care: publicClientCareRecord(record) });
  })
);

router.put(
  "/:id/care-record",
  asyncHandler(async (req, res) => {
    await findClientOrFail(req, req.params.id);
    requireWorkspacePermission("canManageClients")(req, res, () => {});

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
        workspaceId: req.workspaceId || null,
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
    const client = await findClientOrFail(req, req.params.id);
    res.json({ client: publicClient(client) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    await findClientOrFail(req, req.params.id);
    requireWorkspacePermission("canManageClients")(req, res, () => {});

    const name = requiredString(req.body.name, "nome", 2);
    const phone = requiredString(req.body.phone, "telefone", 8);
    const email = optionalEmail(req.body.email);
    const notes = optionalString(req.body.notes);

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        name,
        phone,
        email,
        notes,
        ...(req.body.isActive === undefined ? {} : { isActive: parseBoolean(req.body.isActive, true) })
      }
    });

    clearClientListCache();
    res.json({ client: publicClient(client) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await findClientOrFail(req, req.params.id);
    requireWorkspacePermission("canManageClients")(req, res, () => {});

    const appointments = await prisma.appointment.count({
      where: workspaceWhere(req, { clientId: req.params.id })
    });

    if (appointments > 0) {
      throw new ApiError(409, "Não é possível excluir cliente com agendamentos vinculados.");
    }

    await prisma.client.delete({ where: { id: req.params.id } });
    clearClientListCache();
    res.status(204).send();
  })
);

export default router;
