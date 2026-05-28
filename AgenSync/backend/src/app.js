import cors from "cors";
import express from "express";
import { errorHandler, notFound } from "./middleware/error.js";
import apiRouter from "./routes/index.js";
import { normalizeEnvValue } from "./utils/env.js";

export const app = express();

const configuredOrigins = normalizeEnvValue(process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowAnyOrigin = configuredOrigins.includes("*");
const explicitOrigins = configuredOrigins.filter((origin) => origin !== "*");

const corsOptions = {
  origin(origin, callback) {
    if (allowAnyOrigin || !origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = String(origin).trim().replace(/\/$/, "");
    const isAllowed = explicitOrigins.includes(normalizedOrigin);
    callback(null, isAllowed);
  }
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use((req, res, next) => {
  if (process.env.API_TIMING_DEBUG !== "1") {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1000000;
    const path = String(req.originalUrl || req.url || "").split("?")[0];
    const workspaceId = req.workspaceId || req.workspace?.id || "";
    const workspaceRole = req.workspaceRole || req.user?.workspaceRole || "";
    const platformRole = req.user?.platformRole || "";

    console.info("[API_TIMING]", {
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      workspaceId,
      workspaceRole,
      platformRole
    });
  });

  next();
});

app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);
