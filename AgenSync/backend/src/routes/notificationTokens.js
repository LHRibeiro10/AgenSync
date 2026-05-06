import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { optionalString, requiredString } from "../utils/validation.js";

const router = Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const token = requiredString(req.body.token, "token");
    const platform = optionalString(req.body.platform) || "web";
    const userAgent = optionalString(req.body.userAgent) || req.get("user-agent") || "";

    const saved = await prisma.notificationToken.upsert({
      where: { token },
      create: {
        userId: req.user.id,
        token,
        platform,
        userAgent,
        lastUsedAt: new Date()
      },
      update: {
        userId: req.user.id,
        platform,
        userAgent,
        lastUsedAt: new Date(),
        disabledAt: null
      }
    });

    res.status(201).json({ token: { id: saved.id, platform: saved.platform, lastUsedAt: saved.lastUsedAt } });
  })
);

router.delete(
  "/",
  asyncHandler(async (req, res) => {
    const token = requiredString(req.body.token, "token");

    await prisma.notificationToken.updateMany({
      where: { token, userId: req.user.id },
      data: { disabledAt: new Date() }
    });

    res.status(204).send();
  })
);

export default router;
