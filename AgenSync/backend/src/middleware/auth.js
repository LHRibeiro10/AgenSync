import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "./error.js";
import { getSuggestedServices } from "../utils/businessOnboarding.js";
import { normalizeEnvValue } from "../utils/env.js";

function jwtSecret() {
  const secret = normalizeEnvValue(process.env.JWT_SECRET);
  if (!secret) {
    throw new ApiError(500, "JWT_SECRET nao configurado no backend.");
  }
  return secret;
}

function supabaseJwtSecret() {
  const secret = normalizeEnvValue(process.env.SUPABASE_JWT_SECRET);
  if (!secret) {
    throw new ApiError(401, "SUPABASE_JWT_SECRET nao configurado no backend.");
  }
  return secret;
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  businessName: true,
  businessLogo: true,
  businessType: true,
  createdAt: true
};

async function authenticateWithLegacyJwt(token) {
  const payload = jwt.verify(token, jwtSecret());
  if (!payload?.userId) throw new ApiError(401, "Sessao invalida.");

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: userSelect
  });

  if (!user) throw new ApiError(401, "Usuario nao encontrado.");
  return user;
}

async function ensureSupabaseUser(payload) {
  const supabaseId = payload?.sub;
  const email = payload?.email;
  if (!supabaseId || !email) throw new ApiError(401, "Token Supabase invalido.");

  const metadata = payload.user_metadata || {};
  const name = metadata.name || email;
  const businessType = metadata.businessType || "Manicure";
  const businessName = metadata.businessName || `Agenda de ${name}`;
  const businessLogo = metadata.businessLogo || null;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { id: supabaseId },
      create: {
        id: supabaseId,
        name,
        email,
        passwordHash: "supabase-auth",
        businessName,
        businessLogo,
        businessType
      },
      update: {
        name,
        email,
        businessName,
        businessLogo,
        businessType
      },
      select: userSelect
    });

    const professionalCount = await tx.professional.count({ where: { userId: user.id } });
    if (!professionalCount) {
      await tx.professional.create({
        data: {
          userId: user.id,
          name: user.name,
          role: "Profissional principal",
          isActive: true
        }
      });
    }

    const servicesCount = await tx.service.count({ where: { userId: user.id } });
    if (!servicesCount) {
      await tx.service.createMany({
        data: getSuggestedServices(user.businessType).map((service) => ({
          userId: user.id,
          name: service.name,
          priceDefault: Number(service.priceDefault || 0),
          durationMinutes: Number(service.durationMinutes || 60),
          isActive: true
        }))
      });
    }

    return user;
  });
}

async function authenticateWithSupabaseJwt(token) {
  const payload = jwt.verify(token, supabaseJwtSecret());
  return ensureSupabaseUser(payload);
}

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Sessao expirada ou nao autenticada.");
  }

  try {
    req.user = await authenticateWithLegacyJwt(token);
  } catch {
    req.user = await authenticateWithSupabaseJwt(token);
  }

  next();
});
