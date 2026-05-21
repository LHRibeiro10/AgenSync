import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { invalidateAuthUserCache, requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { getSuggestedServices } from "../utils/businessOnboarding.js";
import { normalizeEnvValue } from "../utils/env.js";
import { publicUser } from "../utils/formatters.js";
import { recordAuditEvent } from "../utils/audit.js";
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

function normalizeInitialServices(body, businessType) {
  const hasCustomServices = Array.isArray(body.initialServices);
  const source = hasCustomServices ? body.initialServices : getSuggestedServices(businessType);

  return source
    .map((service) => {
      const name = String(service.name || "").trim();
      if (name.length < 2) return null;

      const priceDefault = Number(service.priceDefault ?? 0);
      if (!Number.isFinite(priceDefault) || priceDefault < 0) {
        throw new ApiError(400, "preco padrao deve ser maior ou igual a zero.");
      }

      const durationMinutes = Number(service.durationMinutes ?? 60);
      if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        throw new ApiError(400, "duracao deve ser maior que zero.");
      }

      return {
        name,
        priceDefault: Number(priceDefault.toFixed(2)),
        durationMinutes,
        isActive: service.isActive !== false
      };
    })
    .filter(Boolean);
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

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const name = requiredString(req.body.name, "nome", 2);
    const email = validateEmail(req.body.email);
    const password = requiredString(req.body.password, "senha", 6);
    const businessName = requiredString(req.body.businessName, "nome do negocio", 2);
    const businessType = requiredString(req.body.businessType, "tipo de negocio", 2);
    const businessLogo = normalizeBusinessLogo(req.body.businessLogo);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ApiError(409, "Ja existe uma conta com esse email.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const initialServices = normalizeInitialServices(req.body, businessType);
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: roleForEmail(email),
          workspaceRole: "OWNER",
          subscriptionStatus: "PAID",
          billingEnabled: false,
          businessName,
          businessLogo,
          businessType
        }
      });

      if (initialServices.length) {
        await tx.service.createMany({
          data: initialServices.map((service) => ({
            userId: createdUser.id,
            ...service
          }))
        });
      }

      await tx.professional.create({
        data: {
          userId: createdUser.id,
          name: createdUser.name,
          role: "Profissional principal",
          isActive: true
        }
      });

      return createdUser;
    });

    await recordAuditEvent({
      req,
      userId: user.id,
      email: user.email,
      eventType: "auth.register",
      message: "Usuario registrado com sucesso."
    });

    res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
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

    await recordAuditEvent({
      req,
      userId: authenticatedUser.id,
      email: authenticatedUser.email,
      eventType: "auth.login_success",
      message: "Login realizado com sucesso."
    });

    res.json({ token: signToken(authenticatedUser.id), user: publicUser(authenticatedUser) });
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

    res.json({ user: req.user });
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
    const businessType = requiredString(req.body.businessType, "tipo de negocio", 2);
    const businessName =
      req.body.businessName === undefined ? undefined : requiredString(req.body.businessName, "nome do negocio", 2);
    const businessLogo = req.body.businessLogo === undefined ? undefined : normalizeBusinessLogo(req.body.businessLogo);
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
        businessType,
        ...(businessName === undefined ? {} : { businessName }),
        ...(businessLogo === undefined ? {} : { businessLogo }),
        ...(whatsappReminderEnabled === undefined ? {} : { whatsappReminderEnabled }),
        ...(whatsappReminderOffsetMinutes === undefined ? {} : { whatsappReminderOffsetMinutes }),
        ...(whatsappReminderMessage === undefined ? {} : { whatsappReminderMessage }),
        ...(whatsappReminderTestPhone === undefined ? {} : { whatsappReminderTestPhone }),
        ...(whatsappConfirmationMessage === undefined ? {} : { whatsappConfirmationMessage }),
        ...(appointmentNotificationsEnabled === undefined ? {} : { appointmentNotificationsEnabled }),
        ...(appointmentNotificationOffsetMinutes === undefined ? {} : { appointmentNotificationOffsetMinutes })
      }
    });

    invalidateAuthUserCache(user.id);
    res.json({ user: publicUser(user) });
  })
);

export default router;
