import { prisma } from "../prisma.js";

function clientIp(req) {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || "");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req?.ip || req?.socket?.remoteAddress || "";
}

function safeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return null;

  const blocked = new Set([
    "password",
    "passwordhash",
    "token",
    "accesstoken",
    "access_token",
    "refreshtoken",
    "refresh_token",
    "authorization"
  ]);
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !blocked.has(String(key).toLowerCase()))
  );
}

function safeWorkspaceId({ req, workspaceId = "", metadata = null }) {
  const candidate = String(workspaceId || req?.workspaceId || metadata?.workspaceId || "").trim();
  if (!candidate || candidate.startsWith("legacy_") || req?.workspaceLegacy === true) return null;
  return candidate;
}

export async function recordAuditEvent({
  req,
  workspaceId = "",
  userId = null,
  email = "",
  eventType,
  message = "",
  route = "",
  metadata = null
}) {
  if (!eventType) return;

  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: safeWorkspaceId({ req, workspaceId, metadata }),
        userId,
        email: email || req?.user?.email || null,
        eventType,
        message: message || null,
        ipAddress: clientIp(req) || null,
        userAgent: req?.get?.("user-agent") || null,
        route: route || req?.originalUrl || null,
        metadata: safeMetadata(metadata)
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // Audit must never break the user-facing flow.
      // eslint-disable-next-line no-console
      console.error("[AUDIT_LOG_ERROR]", error?.message || error);
    }
  }
}

export function publicAuditLog(log) {
  return {
    id: log.id,
    workspaceId: log.workspaceId || "",
    userId: log.userId || "",
    userName: log.user?.name || "",
    email: log.email || log.user?.email || "",
    eventType: log.eventType,
    message: log.message || "",
    ipAddress: log.ipAddress || "",
    userAgent: log.userAgent || "",
    route: log.route || "",
    metadata: log.metadata || null,
    createdAt: log.createdAt
  };
}
