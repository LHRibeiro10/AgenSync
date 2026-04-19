import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { getSuggestedServices } from "../utils/businessOnboarding.js";
import { publicUser } from "../utils/formatters.js";
import { requiredString, validateEmail } from "../utils/validation.js";

const router = Router();
const jwtSecret = () => process.env.JWT_SECRET || "agensync-dev-secret";

function signToken(userId) {
  return jwt.sign({ userId }, jwtSecret(), { expiresIn: "7d" });
}

function signPasswordResetToken(userId) {
  return jwt.sign({ userId, purpose: "password-reset" }, jwtSecret(), { expiresIn: "30m" });
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
        throw new ApiError(400, "preço padrão deve ser maior ou igual a zero.");
      }

      const durationMinutes = Number(service.durationMinutes ?? 60);
      if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        throw new ApiError(400, "duração deve ser maior que zero.");
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
    throw new ApiError(400, "Logo inválida.");
  }
  if (logo.length > 900000) {
    throw new ApiError(400, "Logo muito grande.");
  }
  return logo;
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const name = requiredString(req.body.name, "nome", 2);
    const email = validateEmail(req.body.email);
    const password = requiredString(req.body.password, "senha", 6);
    const businessName = requiredString(req.body.businessName, "nome do negócio", 2);
    const businessType = requiredString(req.body.businessType, "tipo de negócio", 2);
    const businessLogo = normalizeBusinessLogo(req.body.businessLogo);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ApiError(409, "Já existe uma conta com esse email.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const initialServices = normalizeInitialServices(req.body, businessType);
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { name, email, passwordHash, businessName, businessLogo, businessType }
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
      throw new ApiError(401, "Email ou senha inválidos.");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Email ou senha inválidos.");
    }

    res.json({ token: signToken(user.id), user: publicUser(user) });
  })
);

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const email = validateEmail(req.body.email);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({ message: "Se o email existir, enviaremos um link de redefiniÃ§Ã£o.", resetUrl: "" });
    }

    const token = signPasswordResetToken(user.id);
    const origin = req.get("origin") || process.env.FRONTEND_URL || "http://localhost:5173";
    res.json({
      message: "Link de redefiniÃ§Ã£o gerado.",
      resetUrl: `${origin}/reset-password?token=${encodeURIComponent(token)}`
    });
  })
);

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const token = requiredString(req.body.token, "token de redefiniÃ§Ã£o");
    const password = requiredString(req.body.password, "senha", 6);
    let payload;

    try {
      payload = jwt.verify(token, jwtSecret());
    } catch {
      throw new ApiError(400, "Link de redefiniÃ§Ã£o invÃ¡lido ou expirado.");
    }

    if (payload.purpose !== "password-reset" || !payload.userId) {
      throw new ApiError(400, "Link de redefiniÃ§Ã£o invÃ¡lido.");
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
    res.json({ user: req.user });
  })
);

router.put(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const businessType = requiredString(req.body.businessType, "tipo de negócio", 2);
    const businessName =
      req.body.businessName === undefined ? undefined : requiredString(req.body.businessName, "nome do negócio", 2);
    const businessLogo = req.body.businessLogo === undefined ? undefined : normalizeBusinessLogo(req.body.businessLogo);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        businessType,
        ...(businessName === undefined ? {} : { businessName }),
        ...(businessLogo === undefined ? {} : { businessLogo })
      }
    });

    res.json({ user: publicUser(user) });
  })
);

export default router;
