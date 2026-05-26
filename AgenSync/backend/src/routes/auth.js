import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { invalidateAuthUserCache, requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { PLAN_SLUGS } from "../config/plans.js";
import { normalizeEnvValue } from "../utils/env.js";
import { publicUser } from "../utils/formatters.js";
import { recordAuditEvent } from "../utils/audit.js";
import { deleteSupabaseAuthUser } from "../utils/supabaseAuthAdmin.js";
import { requireWorkspaceManager } from "../utils/accessControl.js";
import { hydrateUserWorkspace } from "../utils/workspaceContext.js";
import { requiredString, validateEmail } from "../utils/validation.js";

const router = Router();
const INITIAL_ADMIN_EMAIL = "luiz.henrique.ribeiro770@gmail.com";

function jwtSecret() {
  const secret = normalizeEnvValue(process.env.JWT_SECRET);
  if (!secret) {
    throw new ApiError(500, "JWT_SECRET nao configurado no backend.");
  }
  return secret;
}

function signToken(userId) {
  return jwt.sign({ userId }, jwtSecret(), { expiresIn: "7d" });
}

function signPasswordResetToken(userId) {
  return jwt.sign({ userId, purpose: "password-reset" }, jwtSecret(), { expiresIn: "30m" });
}

function roleForEmail(email) {
  return String(email || "").trim().toLowerCase() === INITIAL_ADMIN_EMAIL ? "ADMIN" : "USER";
}

async function ensureInitialAdminRole(user) {
  if (!user?.id) return user;
  if (roleForEmail(user.email) !== "ADMIN") return user;
  if (String(user.role || "").toUpperCase() === "ADMIN") return user;

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" }
  });

  invalidateAuthUserCache(user.id);
  return updatedUser;
}

function normalizeBusinessLogo(value) {
  const logo = String(value || "").trim();
  if (!logo) return null;
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(logo)) {
    throw new ApiError(400, "Logo invalida.");
  }
  if (logo.length > 900000) {
    throw new ApiError(400, "Logo muito grande.");
  }
  return logo;
}

function optionalBoolean(value) {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return Boolean(value);
}

function optionalReminderOffset(value) {
  if (value === undefined) return undefined;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 10080) {
    throw new ApiError(400, "Tempo do lembrete invalido.");
  }
  return minutes;
}

function optionalLongString(value, fieldName, maxLength = 1200) {
  if (value === undefined) return undefined;
  const text = String(value || "").trim();
  if (text.length > maxLength) {
    throw new ApiError(400, `${fieldName} deve ter ate ${maxLength} caracteres.`);
  }
  return text;
}

function bearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token || "" : "";
}

function requestUsesSupabaseAuth(req) {
  const token = bearerToken(req);
  if (!token) return false;

  const decoded = jwt.decode(token);
  const payload = decoded?.payload && typeof decoded.payload === "object" ? decoded.payload : decoded;
  return Boolean(payload?.sub && (payload?.iss || payload?.aud) && !payload?.userId);
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const name = requiredString(req.body.name, "nome", 2);
    const email = validateEmail(req.body.email);
    const password = requiredString(req.body.password, "senha", 6);
    const businessName =
      optionalLongString(req.body.businessName, "nome do negocio", 160) || `Agenda de ${name}`;
    const businessType = optionalLongString(req.body.businessType, "tipo de negocio", 80) || "Outro";
    const businessLogo = normalizeBusinessLogo(req.body.businessLogo);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ApiError(409, "Ja existe uma conta com esse email.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.$transaction(async (tx) =>
      tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: roleForEmail(email),
          workspaceRole: "OWNER",
          platformPlan: PLAN_SLUGS.PADRAO,
          subscriptionStatus: "PAID",
          billingEnabled: false,
          businessName,
          businessLogo,
          businessType,
          onboardingCompleted: false
        }
      })
    );

    await recordAuditEvent({
      req,
      userId: user.id,
      email: user.email,
      eventType: "auth.register",
      message: "Usuario registrado com sucesso."
    });

    const hydratedUser = await hydrateUserWorkspace(user);
    res.status(201).json({ token: signToken(user.id), user: publicUser(hydratedUser) });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = validateEmail(req.body.email);
    const password = requiredString(req.body.password, "senha");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await recordAuditEvent({
        req,
        email,
        eventType: "auth.login_failed",
        message: "Tentativa de login com email nao encontrado."
      });
      throw new ApiError(401, "Email ou senha invalidos.");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await recordAuditEvent({
        req,
        userId: user.id,
        email: user.email,
        eventType: "auth.login_failed",
        message: "Tentativa de login com senha invalida."
      });
      throw new ApiError(401, "Email ou senha invalidos.");
    }

    const authenticatedUser = await ensureInitialAdminRole(user);
    if (String(authenticatedUser.accountStatus || "ACTIVE") !== "ACTIVE") {
      throw new ApiError(403, "Conta inativa. Entre em contato com o suporte.");
    }
    if (String(authenticatedUser.userStatus || "ACTIVE") !== "ACTIVE") {
      throw new ApiError(403, "Usuario inativo. Entre em contato com o suporte.");
    }

    await recordAuditEvent({
      req,
      userId: authenticatedUser.id,
      email: authenticatedUser.email,
      eventType: "auth.login_success",
      message: "Login realizado com sucesso."
    });

    const hydratedUser = await hydrateUserWorkspace(authenticatedUser);
    res.json({ token: signToken(authenticatedUser.id), user: publicUser(hydratedUser) });
  })
);

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const email = validateEmail(req.body.email);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({ message: "Se o email existir, enviaremos um link de redefinicao.", resetUrl: "" });
    }

    const token = signPasswordResetToken(user.id);
    const configuredOrigin = normalizeEnvValue(process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "")
      .split(",")[0]
      .trim()
      .replace(/\/$/, "");
    const origin = (req.get("origin") || configuredOrigin).replace(/\/$/, "");

    if (!origin) {
      throw new ApiError(500, "FRONTEND_URL/CORS_ORIGIN nao configurado para recuperar senha.");
    }

    res.json({
      message: "Link de redefinicao gerado.",
      resetUrl: `${origin}/reset-password?token=${encodeURIComponent(token)}`
    });
  })
);

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const token = requiredString(req.body.token, "token de redefinicao");
    const password = requiredString(req.body.password, "senha", 6);
    let payload;

    try {
      payload = jwt.verify(token, jwtSecret());
    } catch {
      throw new ApiError(400, "Link de redefinicao invalido ou expirado.");
    }

    if (payload.purpose !== "password-reset" || !payload.userId) {
      throw new ApiError(400, "Link de redefinicao invalido.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash }
    });

    res.json({ message: "Senha atualizada com sucesso." });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authEvent = String(req.get("x-agensync-auth-event") || "");
    if (authEvent === "login_success" || authEvent === "register") {
      await recordAuditEvent({
        req,
        userId: req.user.id,
        email: req.user.email,
        eventType: authEvent === "register" ? "auth.register" : "auth.login_success",
        message: authEvent === "register" ? "Cadastro Supabase validado pelo backend." : "Login Supabase validado pelo backend."
      });
    }

    res.json({ user: publicUser(req.user) });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await recordAuditEvent({
      req,
      userId: req.user.id,
      email: req.user.email,
      eventType: "auth.logout",
      message: "Logout solicitado pelo usuario."
    });

    res.status(204).send();
  })
);

router.put(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    requireWorkspaceManager(req);
    const businessType =
      req.body.businessType === undefined ? undefined : requiredString(req.body.businessType, "tipo de negocio", 2);
    const businessName =
      req.body.businessName === undefined ? undefined : requiredString(req.body.businessName, "nome do negocio", 2);
    const businessLogo = req.body.businessLogo === undefined ? undefined : normalizeBusinessLogo(req.body.businessLogo);
    const businessTypeCustom = optionalLongString(req.body.businessTypeCustom, "Tipo personalizado", 120);
    const businessPhone = optionalLongString(req.body.businessPhone, "Telefone do negocio", 32);
    const businessCity = optionalLongString(req.body.businessCity, "Cidade", 120);
    const businessAddress = optionalLongString(req.body.businessAddress, "Endereco", 240);
    const whatsappReminderEnabled = optionalBoolean(req.body.whatsappReminderEnabled);
    const whatsappReminderOffsetMinutes = optionalReminderOffset(req.body.whatsappReminderOffsetMinutes);
    const whatsappReminderMessage = optionalLongString(req.body.whatsappReminderMessage, "Mensagem do lembrete");
    const whatsappReminderTestPhone = optionalLongString(req.body.whatsappReminderTestPhone, "Telefone de teste", 32);
    const whatsappConfirmationMessage = optionalLongString(
      req.body.whatsappConfirmationMessage,
      "Mensagem de confirmacao"
    );
    const appointmentNotificationsEnabled = optionalBoolean(req.body.appointmentNotificationsEnabled);
    const appointmentNotificationOffsetMinutes = optionalReminderOffset(req.body.appointmentNotificationOffsetMinutes);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(businessType === undefined ? {} : { businessType }),
        ...(businessName === undefined ? {} : { businessName }),
        ...(businessLogo === undefined ? {} : { businessLogo }),
        ...(businessTypeCustom === undefined ? {} : { businessTypeCustom }),
        ...(businessPhone === undefined ? {} : { businessPhone }),
        ...(businessCity === undefined ? {} : { businessCity }),
        ...(businessAddress === undefined ? {} : { businessAddress }),
        ...(whatsappReminderEnabled === undefined ? {} : { whatsappReminderEnabled }),
        ...(whatsappReminderOffsetMinutes === undefined ? {} : { whatsappReminderOffsetMinutes }),
        ...(whatsappReminderMessage === undefined ? {} : { whatsappReminderMessage }),
        ...(whatsappReminderTestPhone === undefined ? {} : { whatsappReminderTestPhone }),
        ...(whatsappConfirmationMessage === undefined ? {} : { whatsappConfirmationMessage }),
        ...(appointmentNotificationsEnabled === undefined ? {} : { appointmentNotificationsEnabled }),
        ...(appointmentNotificationOffsetMinutes === undefined ? {} : { appointmentNotificationOffsetMinutes })
      }
    });

    if (businessName !== undefined && req.workspaceId) {
      try {
        await prisma.workspace.updateMany({
          where: { id: req.workspaceId, ownerId: req.user.id },
          data: { name: businessName }
        });
      } catch (error) {
        if (String(error?.code || "") !== "P2021" && String(error?.code || "") !== "P2022") {
          throw error;
        }
      }
    }

    invalidateAuthUserCache(user.id);
    res.json({ user: publicUser(await hydrateUserWorkspace(user)) });
  })
);

router.delete(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const workspaceRole = String(req.user.workspaceRole || "OWNER").toUpperCase();
    const platformRole = String(req.user.platformRole || "USER").toUpperCase();
    if (workspaceRole !== "OWNER") {
      throw new ApiError(403, "Somente o proprietario pode excluir a conta.");
    }
    if (platformRole === "DEVELOPER" || platformRole === "PLATFORM_OWNER") {
      throw new ApiError(403, "Contas da plataforma nao podem ser excluidas por aqui.");
    }

    const usesSupabaseAuth = requestUsesSupabaseAuth(req);
    let removedSupabaseAuthUser = false;

    if (usesSupabaseAuth) {
      await deleteSupabaseAuthUser(userId);
      removedSupabaseAuthUser = true;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.appointmentReminder.deleteMany({ where: { userId } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.pushSubscription.deleteMany({ where: { userId } });
        await tx.notificationToken.deleteMany({ where: { userId } });
        await tx.appointment.deleteMany({ where: { userId } });
        await tx.productSale.deleteMany({ where: { userId } });
        await tx.monthlyPlan.deleteMany({ where: { userId } });
        await tx.expense.deleteMany({ where: { userId } });
        await tx.product.deleteMany({ where: { userId } });
        await tx.client.deleteMany({ where: { userId } });
        await tx.service.deleteMany({ where: { userId } });
        await tx.professional.deleteMany({ where: { userId } });
        await tx.auditLog.updateMany({ where: { userId }, data: { userId: null } });
        await tx.user.delete({ where: { id: userId } });
      });
    } catch (error) {
      if (removedSupabaseAuthUser) {
        await prisma.user
          .update({
            where: { id: userId },
            data: {
              accountStatus: "INACTIVE",
              userStatus: "INACTIVE",
              billingEnabled: false
            }
          })
          .catch(() => null);
      }
      throw error;
    }

    invalidateAuthUserCache(userId);
    res.json({ ok: true });
  })
);

export default router;
