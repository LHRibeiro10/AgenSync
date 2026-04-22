import jwt from "jsonwebtoken";
import { createPublicKey } from "node:crypto";
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

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
const jwksCache = new Map();

function getSupabaseJwtSecret() {
  return normalizeEnvValue(process.env.SUPABASE_JWT_SECRET);
}

function decodeJwt(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded !== "object") {
    throw new ApiError(401, "Token Supabase invalido.");
  }
  return decoded;
}

function resolveSupabaseJwksUrl(issuer) {
  const safeIssuer = String(issuer || "").trim();
  if (!safeIssuer) {
    throw new ApiError(401, "Token Supabase sem emissor.");
  }

  const baseUrl = safeIssuer.replace(/\/auth\/v1\/?$/i, "").replace(/\/$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new ApiError(401, "Token Supabase com emissor invalido.");
  }

  return `${baseUrl}/auth/v1/.well-known/jwks.json`;
}

async function fetchSupabaseJwks(jwksUrl) {
  const now = Date.now();
  const cached = jwksCache.get(jwksUrl);
  if (cached && cached.expiresAt > now) {
    return cached.keys;
  }

  let response;
  try {
    response = await fetch(jwksUrl);
  } catch {
    throw new ApiError(401, "Nao foi possivel validar o token Supabase.");
  }

  if (!response.ok) {
    throw new ApiError(401, "Nao foi possivel validar o token Supabase.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(401, "Resposta de validacao de token invalida.");
  }

  const keys = Array.isArray(payload?.keys) ? payload.keys : [];
  if (!keys.length) {
    throw new ApiError(401, "Nenhuma chave publica encontrada para validar o token.");
  }

  jwksCache.set(jwksUrl, {
    keys,
    expiresAt: now + JWKS_CACHE_TTL_MS
  });
  return keys;
}

async function verifySupabaseJwt(token) {
  const decoded = decodeJwt(token);
  const header = decoded.header || {};
  const payload = decoded.payload || {};
  const algorithm = String(header.alg || "");

  if (!algorithm) {
    throw new ApiError(401, "Token Supabase sem algoritmo.");
  }

  if (algorithm.startsWith("HS")) {
    const secret = getSupabaseJwtSecret();
    if (!secret) {
      throw new ApiError(401, "SUPABASE_JWT_SECRET nao configurado no backend.");
    }
    return jwt.verify(token, secret, { algorithms: [algorithm] });
  }

  const jwksUrl = resolveSupabaseJwksUrl(payload.iss);
  const keys = await fetchSupabaseJwks(jwksUrl);
  const kid = String(header.kid || "");

  const matchingKey = keys.find((key) => !kid || key?.kid === kid);
  if (!matchingKey) {
    throw new ApiError(401, "Chave publica do token nao encontrada.");
  }

  let publicKey;
  try {
    publicKey = createPublicKey({ key: matchingKey, format: "jwk" });
  } catch {
    throw new ApiError(401, "Chave publica do token Supabase invalida.");
  }

  return jwt.verify(token, publicKey, {
    algorithms: [algorithm],
    issuer: String(payload.iss || "")
  });
}

function isJwtValidationError(error) {
  const name = String(error?.name || "");
  return name === "JsonWebTokenError" || name === "TokenExpiredError" || name === "NotBeforeError";
}

function debugAuthLog(label, error) {
  if (process.env.AUTH_DEBUG !== "1") return;
  const statusCode = error?.statusCode ?? "";
  const code = error?.code ?? "";
  const name = error?.name ?? "";
  const message = error?.message ?? "";
  // eslint-disable-next-line no-console
  console.error(`[AUTH_DEBUG] ${label}`, { statusCode, code, name, message });
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

 const user = await prisma.user.upsert({
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

const [professionalCount, servicesCount] = await Promise.all([
  prisma.professional.count({ where: { userId: user.id } }),
  prisma.service.count({ where: { userId: user.id } })
]);

if (!professionalCount) {
  await prisma.professional.create({
    data: {
      userId: user.id,
      name: user.name,
      role: "Profissional principal",
      isActive: true
    }
  });
}

if (!servicesCount) {
  await prisma.service.createMany({
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
}

async function authenticateWithSupabaseJwt(token) {
  const payload = await verifySupabaseJwt(token);
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
  } catch (legacyError) {
    debugAuthLog("legacy_error", legacyError);
    try {
      req.user = await authenticateWithSupabaseJwt(token);
    } catch (supabaseError) {
      debugAuthLog("supabase_error", supabaseError);
      const isMissingSupabaseSecret =
        supabaseError instanceof ApiError &&
        supabaseError.message === "SUPABASE_JWT_SECRET nao configurado no backend.";

      if (isMissingSupabaseSecret) {
        throw supabaseError;
      }

      const isAuthFailure =
        isJwtValidationError(supabaseError) ||
        (supabaseError instanceof ApiError && supabaseError.statusCode === 401);

      if (isAuthFailure) {
        throw new ApiError(401, "Sessao expirada ou nao autenticada.");
      }

      throw supabaseError;
    }
  }

  next();
});
