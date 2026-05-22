import { ApiError } from "../middleware/error.js";
import { normalizeEnvValue } from "./env.js";

function supabaseUrl() {
  return normalizeEnvValue(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/$/, "");
}

function supabaseSecretKey() {
  return normalizeEnvValue(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_KEY
  );
}

function supabaseApiKey() {
  return normalizeEnvValue(
    process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      supabaseSecretKey()
  );
}

function requireSupabaseAdminConfig() {
  const url = supabaseUrl();
  const secretKey = supabaseSecretKey();

  if (!url || !secretKey) {
    throw new ApiError(
      500,
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas no backend para excluir usuarios Supabase."
    );
  }

  return { url, secretKey };
}

async function responseMessage(response, fallback) {
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (payload && typeof payload === "object") {
    return payload.message || payload.msg || payload.error_description || payload.error || fallback;
  }

  return fallback;
}

export async function deleteSupabaseAuthUser(userId) {
  const { url, secretKey } = requireSupabaseAdminConfig();

  let response;
  try {
    response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ should_soft_delete: false })
    });
  } catch {
    throw new ApiError(502, "Nao foi possivel conectar ao Supabase Auth para excluir o usuario.");
  }

  if (response.ok || response.status === 404) return;

  const message = await responseMessage(response, "Nao foi possivel excluir o usuario no Supabase Auth.");
  throw new ApiError(502, `Nao foi possivel excluir a conta no Supabase Auth: ${message}`);
}

async function ensureSupabaseAuthUserExistsWithAdmin(userId, url, secretKey) {
  let response;
  try {
    response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`
      }
    });
  } catch {
    throw new ApiError(502, "Nao foi possivel conectar ao Supabase Auth para validar o usuario.");
  }

  if (response.ok) return true;
  if (response.status === 404) throw new ApiError(401, "Sessao expirada ou nao autenticada.");

  const message = await responseMessage(response, "Nao foi possivel validar o usuario Supabase.");
  throw new ApiError(502, message);
}

async function ensureSupabaseAuthUserExistsWithToken(token, url, apiKey) {
  let response;
  try {
    response = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${token}`
      }
    });
  } catch {
    throw new ApiError(502, "Nao foi possivel conectar ao Supabase Auth para validar o usuario.");
  }

  if (response.ok) return true;
  if (![401, 403, 404].includes(response.status)) {
    const message = await responseMessage(response, "Nao foi possivel validar o usuario Supabase.");
    throw new ApiError(502, message);
  }

  throw new ApiError(401, "Sessao expirada ou nao autenticada.");
}

export async function ensureSupabaseAuthUserExists(userId, token) {
  const url = supabaseUrl();
  const secretKey = supabaseSecretKey();
  const apiKey = supabaseApiKey();

  if (!url) return;
  if (secretKey) {
    await ensureSupabaseAuthUserExistsWithAdmin(userId, url, secretKey);
    return;
  }
  if (apiKey && token) await ensureSupabaseAuthUserExistsWithToken(token, url, apiKey);
}
