import { Router } from "express";
import { prisma } from "../prisma.js";
import { invalidateAuthUserCache, isPlatformOwner } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { getCurrentPlan } from "../config/plans.js";
import { businessTypes, findBusinessType, getSuggestedServices } from "../utils/businessOnboarding.js";
import { publicUser } from "../utils/formatters.js";
import { workspaceWhere } from "../utils/accessControl.js";
import {
  optionalEmail,
  optionalString,
  parseBoolean,
  parsePositiveInteger,
  parsePositiveMoney,
  requiredString
} from "../utils/validation.js";

const router = Router();

function ensureWorkspaceOwner(user) {
  if (isPlatformOwner(user)) {
    throw new ApiError(403, "Onboarding nao se aplica a contas da plataforma.");
  }

  if (String(user.workspaceRole || "OWNER").toUpperCase() !== "OWNER") {
    throw new ApiError(403, "Onboarding deve ser feito pelo proprietario da conta.");
  }
}

function text(value, maxLength = 240) {
  return optionalString(value).slice(0, maxLength);
}

function normalizeNameKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function onboardingCounts(req) {
  const [services, professionals, clients, appointments] = await Promise.all([
    prisma.service.count({ where: workspaceWhere(req) }),
    prisma.professional.count({ where: workspaceWhere(req) }),
    prisma.client.count({ where: workspaceWhere(req) }),
    prisma.appointment.count({ where: { ...workspaceWhere(req), kind: "APPOINTMENT" } })
  ]);

  return { services, professionals, clients, appointments };
}

function shouldRequireOnboarding(user) {
  if (!user) return false;
  if (isPlatformOwner(user)) return false;
  if (String(user.workspaceRole || "OWNER").toUpperCase() !== "OWNER") return false;
  return user.onboardingCompleted !== true;
}

async function statusPayload(req, user = req.user) {
  const counts = await onboardingCounts(req);
  return {
    onboardingRequired: shouldRequireOnboarding(user),
    onboardingCompleted: user.onboardingCompleted === true,
    counts,
    user: publicUser(user),
    businessTypes,
    suggestedServices: getSuggestedServices(user.businessType || "Outro")
  };
}

function normalizeServiceList(rawServices) {
  const services = Array.isArray(rawServices) ? rawServices : [];
  return services
    .filter((service) => service?.selected !== false)
    .map((service) => {
      const name = requiredString(service.name, "nome do servico", 2);
      return {
        name,
        priceDefault: parsePositiveMoney(service.priceDefault ?? 0, "valor do servico"),
        durationMinutes: parsePositiveInteger(service.durationMinutes ?? 60, "duracao do servico"),
        isActive: parseBoolean(service.isActive, true)
      };
    });
}

function normalizeProfessionalList(rawProfessionals) {
  const professionals = Array.isArray(rawProfessionals) ? rawProfessionals : [];
  return professionals.map((professional) => ({
    name: requiredString(professional.name, "nome do profissional", 2),
    role: text(professional.role || "Profissional", 120),
    email: optionalEmail(professional.email, "email do profissional"),
    phone: text(professional.phone, 32),
    monthlyGoal:
      professional.monthlyGoal === undefined || professional.monthlyGoal === null || professional.monthlyGoal === ""
        ? null
        : parsePositiveMoney(professional.monthlyGoal, "meta mensal"),
    isActive: parseBoolean(professional.isActive, true)
  }));
}

function normalizeClientList(rawClients) {
  const clients = Array.isArray(rawClients) ? rawClients : [];
  return clients.map((client) => ({
    name: requiredString(client.name, "nome do cliente", 2),
    phone: requiredString(client.phone, "telefone do cliente", 8),
    email: optionalEmail(client.email, "email do cliente"),
    notes: text(client.notes, 1000),
    isActive: true
  }));
}

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    res.json(await statusPayload(req));
  })
);

router.post(
  "/business",
  asyncHandler(async (req, res) => {
    ensureWorkspaceOwner(req.user);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        businessName: requiredString(req.body.businessName, "nome do negocio", 2),
        businessPhone: text(req.body.businessPhone, 32),
        businessCity: text(req.body.businessCity, 120),
        businessAddress: text(req.body.businessAddress, 240)
      }
    });

    invalidateAuthUserCache(user.id);
    res.json(await statusPayload(req, user));
  })
);

router.post(
  "/type",
  asyncHandler(async (req, res) => {
    ensureWorkspaceOwner(req.user);

    const selectedType = findBusinessType(requiredString(req.body.businessType, "tipo de negocio", 2));
    const businessTypeCustom =
      selectedType.id === "personalizada"
        ? requiredString(req.body.businessTypeCustom, "tipo personalizado", 2)
        : text(req.body.businessTypeCustom, 120);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        businessType: selectedType.label,
        businessTypeCustom: selectedType.id === "personalizada" ? businessTypeCustom : null
      }
    });

    invalidateAuthUserCache(user.id);
    res.json({
      ...(await statusPayload(req, user)),
      suggestedServices: getSuggestedServices(selectedType.id)
    });
  })
);

router.post(
  "/services",
  asyncHandler(async (req, res) => {
    ensureWorkspaceOwner(req.user);
    if (req.body.skip === true) {
      return res.json({ createdCount: 0, skipped: true, ...(await statusPayload(req)) });
    }

    const services = normalizeServiceList(req.body.services);
    if (!services.length) {
      throw new ApiError(400, "Adicione pelo menos um servico ou pule esta etapa.");
    }

    const existing = await prisma.service.findMany({
      where: workspaceWhere(req),
      select: { name: true }
    });
    const existingKeys = new Set(existing.map((service) => normalizeNameKey(service.name)));
    const toCreate = services.filter((service) => {
      const key = normalizeNameKey(service.name);
      if (!key || existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    let createdCount = 0;
    if (toCreate.length) {
      const result = await prisma.service.createMany({
        data: toCreate.map((service) => ({ workspaceId: req.workspaceId || null, userId: req.user.id, ...service }))
      });
      createdCount = result.count;
    }

    res.status(201).json({ createdCount, ...(await statusPayload(req)) });
  })
);

router.post(
  "/professionals",
  asyncHandler(async (req, res) => {
    ensureWorkspaceOwner(req.user);
    const professionals = normalizeProfessionalList(req.body.professionals);
    if (!professionals.length) {
      throw new ApiError(400, "Mantenha pelo menos um profissional ativo.");
    }
    const plan = getCurrentPlan(req.user);
    const activeRequested = professionals.filter((professional) => professional.isActive !== false).length;
    if (activeRequested > plan.maxProfessionals) {
      throw new ApiError(409, `Seu plano permite ate ${plan.maxProfessionals} profissionais.`);
    }

    const [primary, ...extraProfessionals] = professionals;
    const existingProfessionals = await prisma.professional.findMany({
      where: workspaceWhere(req),
      select: { id: true, name: true, email: true, isActive: true },
      orderBy: { createdAt: "asc" }
    });
    const existingPrimary = req.user.professionalId
      ? existingProfessionals.find((professional) => professional.id === req.user.professionalId) || null
      : existingProfessionals[0] || null;
    const existingKeys = new Set(
      existingProfessionals.flatMap((professional) => [
        normalizeNameKey(professional.name),
        professional.email ? `email:${professional.email}` : ""
      ]).filter(Boolean)
    );
    const toCreate = extraProfessionals.filter((professional) => {
      const keys = [
        normalizeNameKey(professional.name),
        professional.email ? `email:${professional.email}` : ""
      ].filter(Boolean);
      if (keys.some((key) => existingKeys.has(key))) return false;
      keys.forEach((key) => existingKeys.add(key));
      return true;
    });
    const projectedActiveProfessionals =
      existingProfessionals.filter((professional) => professional.isActive && professional.id !== existingPrimary?.id).length +
      (primary.isActive !== false ? 1 : 0) +
      toCreate.filter((professional) => professional.isActive !== false).length;

    if (projectedActiveProfessionals > plan.maxProfessionals) {
      throw new ApiError(409, `Seu plano permite ate ${plan.maxProfessionals} profissionais.`);
    }

    const primaryProfessional = existingPrimary
      ? await prisma.professional.update({
          where: { id: existingPrimary.id },
          data: { ...(req.workspaceId ? { workspaceId: req.workspaceId } : {}), ...primary }
        })
      : await prisma.professional.create({
          data: { workspaceId: req.workspaceId || null, userId: req.user.id, ...primary, role: primary.role || "Profissional principal" }
        });

    if (toCreate.length) {
      await prisma.professional.createMany({
        data: toCreate.map((professional) => ({ workspaceId: req.workspaceId || null, userId: req.user.id, ...professional }))
      });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { professionalId: primaryProfessional.id }
    });
    if (req.workspaceId) {
      await prisma.workspaceMember.updateMany({
        where: { workspaceId: req.workspaceId, userId: req.user.id },
        data: { professionalId: primaryProfessional.id }
      });
    }

    invalidateAuthUserCache(user.id);
    res.status(201).json({ primaryProfessionalId: primaryProfessional.id, ...(await statusPayload(req, user)) });
  })
);

router.post(
  "/clients",
  asyncHandler(async (req, res) => {
    ensureWorkspaceOwner(req.user);
    if (req.body.skip === true) {
      return res.json({ createdCount: 0, skipped: true, ...(await statusPayload(req)) });
    }

    const clients = normalizeClientList(req.body.clients);
    if (!clients.length) {
      return res.json({ createdCount: 0, ...(await statusPayload(req)) });
    }

    const existing = await prisma.client.findMany({
      where: workspaceWhere(req),
      select: { name: true, phone: true, email: true }
    });
    const existingKeys = new Set(
      existing.flatMap((client) => [
        client.phone ? `phone:${client.phone.replace(/\D/g, "")}` : "",
        client.email ? `email:${client.email}` : "",
        client.phone ? `name_phone:${normalizeNameKey(client.name)}_${client.phone.replace(/\D/g, "")}` : ""
      ]).filter(Boolean)
    );

    const toCreate = clients.filter((client) => {
      const phoneKey = client.phone.replace(/\D/g, "");
      const keys = [
        phoneKey ? `phone:${phoneKey}` : "",
        client.email ? `email:${client.email}` : "",
        phoneKey ? `name_phone:${normalizeNameKey(client.name)}_${phoneKey}` : ""
      ].filter(Boolean);
      if (keys.some((key) => existingKeys.has(key))) return false;
      keys.forEach((key) => existingKeys.add(key));
      return true;
    });

    let createdCount = 0;
    if (toCreate.length) {
      const result = await prisma.client.createMany({
        data: toCreate.map((client) => ({ workspaceId: req.workspaceId || null, userId: req.user.id, ...client }))
      });
      createdCount = result.count;
    }

    res.status(201).json({ createdCount, ...(await statusPayload(req)) });
  })
);

router.post(
  "/complete",
  asyncHandler(async (req, res) => {
    ensureWorkspaceOwner(req.user);

    const counts = await onboardingCounts(req);
    let professionalId = req.user.professionalId || "";

    if (!counts.professionals) {
      const professional = await prisma.professional.create({
        data: {
          workspaceId: req.workspaceId || null,
          userId: req.user.id,
          name: req.user.name,
          role: "Profissional principal",
          isActive: true
        }
      });
      professionalId = professional.id;
    }

    if (!professionalId) {
      const primary = await prisma.professional.findFirst({
        where: workspaceWhere(req),
        orderBy: { createdAt: "asc" }
      });
      professionalId = primary?.id || "";
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        professionalId: professionalId || null
      }
    });
    if (req.workspaceId && professionalId) {
      await prisma.workspaceMember.updateMany({
        where: { workspaceId: req.workspaceId, userId: req.user.id },
        data: { professionalId }
      });
    }

    invalidateAuthUserCache(user.id);
    res.json(await statusPayload(req, user));
  })
);

export default router;
