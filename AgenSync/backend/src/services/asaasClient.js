import { ApiError } from "../middleware/error.js";
import { normalizeEnvValue } from "../utils/env.js";

const DEFAULT_TIMEOUT_MS = 30000;
const SANDBOX_BASE_URL = "https://api-sandbox.asaas.com/v3";
const PRODUCTION_BASE_URL = "https://api.asaas.com/v3";

export function getAsaasConfig() {
  const env = normalizeEnvValue(process.env.ASAAS_ENV || "sandbox").toLowerCase();
  const baseUrl =
    normalizeEnvValue(process.env.ASAAS_BASE_URL) ||
    (env === "production" || env === "prod" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL);

  return {
    env,
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey: normalizeEnvValue(process.env.ASAAS_API_KEY),
    webhookToken: normalizeEnvValue(process.env.ASAAS_WEBHOOK_TOKEN),
    walletId: normalizeEnvValue(process.env.ASAAS_WALLET_ID),
    notificationDisabled: normalizeEnvValue(process.env.ASAAS_NOTIFICATION_DISABLED || "false").toLowerCase() === "true"
  };
}

function safePath(path) {
  const text = String(path || "");
  return text.startsWith("/") ? text : `/${text}`;
}

function asaasErrorMessage(payload, fallback) {
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    return payload.errors.map((item) => item.description || item.message).filter(Boolean).join(" ");
  }
  return payload?.message || fallback;
}

export async function asaasRequest(path, { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const config = getAsaasConfig();
  if (!config.apiKey) {
    throw new ApiError(500, "ASAAS_API_KEY nao configurada no backend.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));

  let response;
  try {
    response = await fetch(`${config.baseUrl}${safePath(path)}`, {
      method,
      signal: controller.signal,
      headers: {
        "User-Agent": "AgenSync/1.0",
        accept: "application/json",
        "content-type": "application/json",
        access_token: config.apiKey
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError(504, "Tempo limite ao comunicar com o Asaas.");
    }
    throw new ApiError(502, "Falha ao comunicar com o Asaas.");
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status >= 500 ? 502 : response.status, asaasErrorMessage(payload, "Erro retornado pelo Asaas."), {
      provider: "asaas",
      status: response.status
    });
  }

  return payload || {};
}
