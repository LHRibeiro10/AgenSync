import { env } from "../config/env.js";
import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/auth/tokenStorage.js";
import { getSupabaseClient } from "../lib/supabase/client.js";
import {
  supabaseApplyRecoverySession,
  supabaseForgotPassword,
  supabaseGetSessionUser,
  supabaseLogin,
  supabaseLogout,
  supabaseRegister,
  supabaseResetPassword
} from "../lib/supabase/auth.js";
import {
  forgotPasswordApi,
  loginApi,
  meApi,
  registerApi,
  resetPasswordApi,
  updateMeApi
} from "../api/modules/authApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";
import { localCoreMockApi } from "../mocks/localApi/coreMockApi.js";

function isSupabaseAuthEnabled() {
  return env.authProvider === "supabase";
}

function queryValue(urlValue, key) {
  const safeUrl = new URL(urlValue, window.location.origin);
  const fromQuery = safeUrl.searchParams.get(key);
  if (fromQuery) return fromQuery;

  const hash = new URLSearchParams((safeUrl.hash || "").replace(/^#/, ""));
  return hash.get(key) || "";
}

function toAuthResult(data) {
  return {
    user: data?.user || null,
    token: data?.token || ""
  };
}

async function updateSupabaseProfile(payload) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase nao configurado.");

  const { data, error } = await client.auth.updateUser({
    data: {
      businessName: payload.businessName,
      businessType: payload.businessType,
      businessLogo: payload.businessLogo
    }
  });

  if (error) throw new Error(error.message || "Nao foi possivel atualizar configuracoes.");

  const user = data.user
    ? {
        id: data.user.id,
        name: data.user.user_metadata?.name || data.user.email || "Usuario",
        email: data.user.email || "",
        businessName: data.user.user_metadata?.businessName || "",
        businessLogo: data.user.user_metadata?.businessLogo || "",
        businessType: data.user.user_metadata?.businessType || "",
        createdAt: data.user.created_at || new Date().toISOString()
      }
    : null;

  return { user };
}

export async function restoreSession() {
  if (isSupabaseAuthEnabled()) {
    try {
      const { user } = await supabaseGetSessionUser();
      return { user, token: "" };
    } catch {
      return { user: null, token: "" };
    }
  }

  const token = getAccessToken();
  if (!token) return { user: null, token: "" };

  try {
    const data = await executeDataSource({
      feature: "auth.me",
      remote: () => meApi(),
      mock: () => localCoreMockApi.me()
    });
    return { user: data.user || null, token };
  } catch {
    clearAccessToken();
    return { user: null, token: "" };
  }
}

export async function login(payload) {
  if (isSupabaseAuthEnabled()) {
    const { user } = await supabaseLogin(payload);
    return toAuthResult({ user, token: "" });
  }

  const data = await executeDataSource({
    feature: "auth.login",
    remote: () => loginApi(payload),
    mock: () => localCoreMockApi.login(payload)
  });
  setAccessToken(data.token);
  return toAuthResult(data);
}

export async function register(payload) {
  if (isSupabaseAuthEnabled()) {
    const { user } = await supabaseRegister(payload);
    return toAuthResult({ user, token: "" });
  }

  const data = await executeDataSource({
    feature: "auth.register",
    remote: () => registerApi(payload),
    mock: () => localCoreMockApi.register(payload)
  });
  setAccessToken(data.token);
  return toAuthResult(data);
}

export async function updateUserSettings(payload) {
  if (isSupabaseAuthEnabled()) {
    return updateSupabaseProfile(payload);
  }

  return executeDataSource({
    feature: "auth.updateUserSettings",
    remote: () => updateMeApi(payload),
    mock: () => localCoreMockApi.updateUserSettings(payload)
  });
}

export async function forgotPassword(payload) {
  if (isSupabaseAuthEnabled()) {
    return supabaseForgotPassword(payload.email);
  }

  return executeDataSource({
    feature: "auth.forgotPassword",
    remote: () => forgotPasswordApi(payload),
    mock: () => localCoreMockApi.forgotPassword(payload)
  });
}

export async function applyPasswordResetSessionFromUrl(urlValue = window.location.href) {
  if (isSupabaseAuthEnabled()) {
    return supabaseApplyRecoverySession(urlValue);
  }

  const token = queryValue(urlValue, "token");
  return { ready: Boolean(token), token };
}

export function getPasswordResetTokenFromUrl(urlValue = window.location.href) {
  return queryValue(urlValue, "token");
}

export async function resetPassword(payload) {
  if (isSupabaseAuthEnabled()) {
    return supabaseResetPassword(payload.password);
  }

  return executeDataSource({
    feature: "auth.resetPassword",
    remote: () => resetPasswordApi(payload),
    mock: () => localCoreMockApi.resetPassword(payload)
  });
}

export async function logout() {
  if (isSupabaseAuthEnabled()) {
    await supabaseLogout().catch(() => null);
  }
  clearAccessToken();
}

export function saveAuthToken(token) {
  setAccessToken(token);
}
