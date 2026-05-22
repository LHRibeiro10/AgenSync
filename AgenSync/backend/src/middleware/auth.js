import jwt from "jsonwebtoken";
import { createPublicKey } from "node:crypto";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "./error.js";
import { getSuggestedServices } from "../utils/businessOnboarding.js";
import { normalizeEnvValue } from "../utils/env.js";
import { ensureSupabaseAuthUserExists } from "../utils/supabaseAuthAdmin.js";

function jwtSecret() {
  const secret = normalizeEnvValue(process.env.JWT_SECRET);
  if (!secret) {
    throw new ApiError(500, "JWT_SECRET nao configurado no backend.");
  }
  return secret;
}

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
const jwksCache = new Map();
const SUPABASE_BOOTSTRAP_CHECK_TTL_MS = 15 * 60 * 1000;
const supabaseBootstrapCheckCache = new Map();

function readPositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
}

const AUTH_USER_CACHE_TTL_MS = Math.max(5000, readPositiveIntEnv("AUTH_USER_CACHE_TTL_MS", 30000));
const AUTH_USER_CACHE_MAX_SIZE = Math.max(100, readPositiveIntEnv("AUTH_USER_CACHE_MAX_SIZE", 5000));
const authUserCache = new Map();

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

function isAuthFailure(error) {
  return isJwtValidationError(error) || (error instanceof ApiError && error.statusCode === 401);
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

function tokenStrategy(token) {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== "object") return "legacy";

  const payload = decoded.payload && typeof decoded.payload === "object" ? decoded.payload : decoded;

  if (payload?.userId) return "legacy";
  if (payload?.iss || payload?.sub || payload?.aud) return "supabase";

  return "legacy";
}

function shouldCheckSupabaseBootstrap(userId) {
  const cachedUntil = supabaseBootstrapCheckCache.get(userId) || 0;
  return Date.now() > cachedUntil;
}

function markSupabaseBootstrapChecked(userId) {
  supabaseBootstrapCheckCache.set(userId, Date.now() + SUPABASE_BOOTSTRAP_CHECK_TTL_MS);
}

function getCachedAuthUser(userId, metadataKey) {
  const cached = authUserCache.get(userId);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    authUserCache.delete(userId);
    return null;
  }

  if (metadataKey !== undefined && cached.metadataKey !== metadataKey) {
    return null;
  }

  return cached.user;
}

function setCachedAuthUser(user, metadataKey = null) {
  if (!user?.id) return;

  if (!authUserCache.has(user.id) && authUserCache.size >= AUTH_USER_CACHE_MAX_SIZE) {
    const oldestKey = authUserCache.keys().next().value;
    if (oldestKey) authUserCache.delete(oldestKey);
  }

  authUserCache.set(user.id, {
    user,
    metadataKey,
    expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS
  });
}

export function invalidateAuthUserCache(userId) {
  if (!userId) return;
  authUserCache.delete(userId);
}

export function requireAdmin(req, res, next) {
  const role = String(req.user?.role || "").toUpperCase();
  if (role !== "ADMIN") {
    throw new ApiError(403, "Acesso restrito a administradores.");
  }
  next();
}

export function isPlatformOwner(user) {
  const role = String(user?.platformRole || "").toUpperCase();
  return role === "DEVELOPER" || role === "PLATFORM_OWNER";
}

export function requirePlatformRole(allowedRoles = ["DEVELOPER", "PLATFORM_OWNER"]) {
  const allowed = new Set(allowedRoles.map((role) => String(role || "").toUpperCase()));

  return (req, res, next) => {
    const role = String(req.user?.platformRole || "").toUpperCase();
    if (!allowed.has(role)) {
      throw new ApiError(403, "Acesso restrito ao painel da plataforma.");
    }
    next();
  };
}

function supabaseMetadataKey({ email, name, businessType, businessName }) {
  return JSON.stringify([email, name, businessType, businessName]);
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  workspaceRole: true,
  platformRole: true,
  platformPlan: true,
  accountStatus: true,
  userStatus: true,
  subscriptionStatus: true,
  subscriptionPaidUntil: true,
  temporaryAccessUntil: true,
  billingEnabled: true,
  businessName: true,
  businessLogo: true,
  businessType: true,
  businessTypeCustom: true,
  businessPhone: true,
  businessCity: true,
  businessAddress: true,
  onboardingCompleted: true,
  onboardingCompletedAt: true,
  professionalId: true,
  whatsappReminderEnabled: true,
  whatsappReminderOffsetMinutes: true,
  whatsappReminderMessage: true,
  whatsappReminderTestPhone: true,
  whatsappConfirmationMessage: true,
  appointmentNotificationsEnabled: true,
  appointmentNotificationOffsetMinutes: true,
  appointmentNotificationChannels: true,
  createdAt: true
};

function roleForEmail(email) {
  return String(email || "").trim().toLowerCase() === "luiz.henrique.ribeiro770@gmail.com" ? "ADMIN" : "USER";
}

async function ensureInitialAdminRole(user) {
  if (!user?.id) return user;
  if (roleForEmail(user.email) !== "ADMIN") return user;
  if (String(user.role || "").toUpperCase() === "ADMIN") return user;

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
    select: userSelect
  });

  setCachedAuthUser(updatedUser);
  return updatedUser;
}

async function authenticateWithLegacyJwt(token) {
  const payload = jwt.verify(token, jwtSecret());
  if (!payload?.userId) throw new ApiError(401, "Sessao invalida.");

  const cachedUser = getCachedAuthUser(payload.userId);
  if (cachedUser) {
    return ensureInitialAdminRole(cachedUser);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: userSelect
  });

  if (!user) throw new ApiError(401, "Usuario nao encontrado.");
  const ensuredUser = await ensureInitialAdminRole(user);
  setCachedAuthUser(ensuredUser);
  return ensuredUser;
}

async function ensureSupabaseBootstrap(user) {
  if (isPlatformOwner(user)) {
    markSupabaseBootstrapChecked(user.id);
    return;
  }

  if (user.onboardingCompleted !== true) {
    markSupabaseBootstrapChecked(user.id);
    return;
  }

  if (!shouldCheckSupabaseBootstrap(user.id)) {
    return;
  }

  const [professionalCount, servicesCount] = await Promise.all([
    prisma.professional.count({ where: { userId: user.id } }),
    prisma.service.count({ where: { userId: user.id } })
  ]);

  if (!professionalCount || !servicesCount) {
    await prisma.$transaction(async (tx) => {
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

      if (!servicesCount) {
        const suggestedServices = getSuggestedServices(user.businessType);
        if (suggestedServices.length) {
          await tx.service.createMany({
            data: suggestedServices.map((service) => ({
              userId: user.id,
              name: service.name,
              priceDefault: Number(service.priceDefault || 0),
              durationMinutes: Number(service.durationMinutes || 60),
              isActive: true
            }))
          });
        }
      }
    });
  }

  markSupabaseBootstrapChecked(user.id);
}

async function ensureSupabaseUser(payload, token) {
  const supabaseId = payload?.sub;
  const email = payload?.email;
  if (!supabaseId || !email) throw new ApiError(401, "Token Supabase invalido.");

  const metadata = payload.user_metadata || {};
  const metadataName = metadata.name || "";
  const metadataBusinessType = metadata.businessType || "";
  const metadataBusinessName = metadata.businessName || "";
  const metadataKey = supabaseMetadataKey({
    email,
    name: metadataName,
    businessType: metadataBusinessType,
    businessName: metadataBusinessName
  });

  const cachedUser = getCachedAuthUser(supabaseId, metadataKey);
  if (cachedUser) {
    await ensureSupabaseBootstrap(cachedUser);
    return cachedUser;
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: supabaseId },
    select: userSelect
  });

  const resolvedName = metadataName || existingUser?.name || email;
  const resolvedBusinessType = metadataBusinessType || existingUser?.businessType || "Outro";
  const resolvedBusinessName = metadataBusinessName || existingUser?.businessName || `Agenda de ${resolvedName}`;
  const resolvedBusinessLogo = existingUser?.businessLogo || null;

  if (!existingUser) {
    await ensureSupabaseAuthUserExists(supabaseId, token);
  }

  const user = !existingUser
    ? await prisma.user.create({
        data: {
          id: supabaseId,
          name: resolvedName,
          email,
          role: roleForEmail(email),
          workspaceRole: "OWNER",
          subscriptionStatus: "PAID",
          billingEnabled: false,
          passwordHash: "supabase-auth",
          businessName: resolvedBusinessName,
          businessLogo: resolvedBusinessLogo,
          businessType: resolvedBusinessType,
          onboardingCompleted: false
        },
        select: userSelect
      })
    : await (async () => {
        const updates = {};
        if (existingUser.name !== resolvedName) updates.name = resolvedName;
        if (existingUser.email !== email) updates.email = email;
        if (existingUser.role !== roleForEmail(email) && roleForEmail(email) === "ADMIN") updates.role = "ADMIN";
        if (metadataBusinessName && existingUser.businessName !== resolvedBusinessName) updates.businessName = resolvedBusinessName;
        if (metadataBusinessType && existingUser.businessType !== resolvedBusinessType) updates.businessType = resolvedBusinessType;

        if (!Object.keys(updates).length) return existingUser;

        return prisma.user.update({
          where: { id: supabaseId },
          data: updates,
          select: userSelect
        });
      })();

  await ensureSupabaseBootstrap(user);

  setCachedAuthUser(user, metadataKey);
  return user;
}

async function authenticateWithSupabaseJwt(token) {
  const payload = await verifySupabaseJwt(token);
  return ensureSupabaseUser(payload, token);
}

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Sessao expirada ou nao autenticada.");
  }

  const strategy = tokenStrategy(token);
  const primaryAuth = strategy === "supabase" ? authenticateWithSupabaseJwt : authenticateWithLegacyJwt;
  const fallbackAuth = strategy === "supabase" ? authenticateWithLegacyJwt : authenticateWithSupabaseJwt;

  try {
    req.user = await primaryAuth(token);
    if (!isPlatformOwner(req.user) && String(req.user.accountStatus || "ACTIVE") !== "ACTIVE") {
      throw new ApiError(403, "Conta inativa. Entre em contato com o suporte.");
    }
    if (!isPlatformOwner(req.user) && String(req.user.userStatus || "ACTIVE") !== "ACTIVE") {
      throw new ApiError(403, "Usuario inativo. Entre em contato com o suporte.");
    }
    next();
    return;
  } catch (primaryError) {
    debugAuthLog("primary_auth_error", primaryError);

    const isMissingSupabaseSecret =
      primaryError instanceof ApiError &&
      primaryError.message === "SUPABASE_JWT_SECRET nao configurado no backend.";

    if (isMissingSupabaseSecret) {
      throw primaryError;
    }

    if (!isAuthFailure(primaryError)) {
      throw primaryError;
    }
  }

  try {
    req.user = await fallbackAuth(token);
    if (!isPlatformOwner(req.user) && String(req.user.accountStatus || "ACTIVE") !== "ACTIVE") {
      throw new ApiError(403, "Conta inativa. Entre em contato com o suporte.");
    }
    if (!isPlatformOwner(req.user) && String(req.user.userStatus || "ACTIVE") !== "ACTIVE") {
      throw new ApiError(403, "Usuario inativo. Entre em contato com o suporte.");
    }
    next();
    return;
  } catch (fallbackError) {
    debugAuthLog("fallback_auth_error", fallbackError);

    const isMissingSupabaseSecret =
      fallbackError instanceof ApiError &&
      fallbackError.message === "SUPABASE_JWT_SECRET nao configurado no backend.";

    if (isMissingSupabaseSecret) {
      throw fallbackError;
    }

    if (isAuthFailure(fallbackError)) {
      throw new ApiError(401, "Sessao expirada ou nao autenticada.");
    }

    throw fallbackError;
  }
});
