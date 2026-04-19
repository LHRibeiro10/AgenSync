import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "./error.js";

const jwtSecret = () => process.env.JWT_SECRET || "agensync-dev-secret";

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Sessão expirada ou não autenticada.");
  }

  try {
    const payload = jwt.verify(token, jwtSecret());
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        businessName: true,
        businessLogo: true,
        businessType: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new ApiError(401, "Usuário não encontrado.");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Sessão expirada ou inválida.");
  }
});
