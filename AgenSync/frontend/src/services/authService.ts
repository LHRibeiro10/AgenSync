import { env } from "../config/env.js";
import { clearAccessToken, getAccessToken, isLikelyOversizedAuthToken, setAccessToken } from "../lib/auth/tokenStorage.js";
import { supabase, supabaseConfigError } from "../lib/supabase.ts";

function publicSupabaseUser(user: any) {
  if (!user) return null;
  const metadata = user.user_metadata || {};

  return {
    id: user.id,
    name: metadata.name || user.email || "Usuario",
    email: user.email || "",
    businessName: metadata.businessName || "",
    businessLogo: metadata.businessLogo || "",
    businessType: metadata.businessType || "",
    createdAt: user.created_at || new Date().toISOString()
  };
}

function authResult(data: any = {}) {
  const session = data.session || null;
  const user = publicSupabaseUser(data.user || session?.user || null);
  const token = safeTokenForAuthHeader(session?.access_token || "");

  if (token) {
    setAccessToken(token);
  } else {
    clearAccessToken();
  }

  return { user, session, token };
}

function authError(message: string, code?: string, details?: any) {
  const next = new Error(message) as Error & { code?: string; details?: any; backendCode?: string };
  if (code) next.code = code;
  if (details) {
    next.details = details;
    if (details.backendCode) next.backendCode = details.backendCode;
  }
  return next;
}

function isBackendAuthDeniedError(error: any) {
  return String(error?.code || "") === "BACKEND_AUTH_DENIED";
}

function requireSupabase() {
  if (!supabase) {
    throw authError(supabaseConfigError, "SUPABASE_NOT_CONFIGURED");
  }

  return supabase;
}

async function clearRejectedSession(client?: any) {
  clearAccessToken();
  await client?.auth?.signOut?.().catch(() => null);
}

export function getAuthConfigurationError() {
  return supabaseConfigError;
}

function friendlyError(error: any, fallback: string) {
  if (!error) return authError(fallback);
  const message = String(error.message || "");

  if (/failed to fetch|fetch failed|network/i.test(message)) {
    return authError("Nao foi possivel conectar ao Supabase. Verifique VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e sua conexao.", "NETWORK_ERROR");
  }

  if (/email not confirmed|email_not_confirmed/i.test(message)) {
    return authError(
      "Seu email ainda nao foi confirmado. Confira sua caixa de entrada ou reenvie o email de confirmacao.",
      "EMAIL_NOT_CONFIRMED"
    );
  }

  if (/invalid login credentials/i.test(message)) {
    return authError("Email ou senha invalidos.", "INVALID_CREDENTIALS");
  }

  return authError(error.message || fallback);
}

function getLoginRedirectUrl() {
  return env.supabaseResetPasswordRedirectUrl.replace(/\/reset-password\/?$/, "/login");
}

function resolveApiBaseUrl() {
  return String(env.apiUrl || "").trim().replace(/\/$/, "");
}

function shouldUseBackendAuthOnly() {
  return env.authProvider === "api" || !supabase;
}

function mergeUser(primary: any, secondary: any) {
  if (!primary && !secondary) return null;
  return {
    ...(primary || {}),
    ...(secondary || {})
  };
}

function safeTokenForAuthHeader(token: string) {
  const safeToken = String(token || "");
  if (!safeToken || isLikelyOversizedAuthToken(safeToken)) return "";
  return safeToken;
}

async function requestBackendMe(token: string, authEvent = "") {
  const safeToken = safeTokenForAuthHeader(token);
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl || !safeToken) return null;

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${safeToken}`
    };
    if (authEvent) headers["X-AgenSync-Auth-Event"] = authEvent;

    const response = await fetch(`${apiBaseUrl}/auth/me`, {
      method: "GET",
      headers
    });

    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (response.status === 401 || response.status === 403) {
        const backendCode = payload?.details?.code || payload?.code || "";
        throw authError(payload?.message || "Sua sessao nao esta mais ativa.", "BACKEND_AUTH_DENIED", {
          ...(payload?.details || {}),
          backendCode,
          status: response.status
        });
      }

      return null;
    }
    const payload = await response.json();
    return payload?.user || null;
  } catch (error) {
    if (isBackendAuthDeniedError(error)) throw error;
    return null;
  }
}

async function requestBackendLogin(payload: any) {
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl) return null;

  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: String(payload.email || "").trim(),
      password: payload.password || ""
    })
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw authError(data?.message || "Email ou senha invalidos.");
  }

  const token = safeTokenForAuthHeader(data?.token || "");
  if (token) setAccessToken(token);

  return {
    user: data?.user || null,
    session: null,
    token
  };
}

async function requestBackendRegister(payload: any) {
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl) throw authError("Backend nao configurado para criar conta.");

  const response = await fetch(`${apiBaseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: String(payload.name || "").trim(),
      email: String(payload.email || "").trim(),
      password: payload.password || "",
      businessName: payload.businessName || "",
      businessType: payload.businessType || "",
      businessLogo: payload.businessLogo || ""
    })
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw authError(data?.message || "Nao foi possivel criar a conta.");
  }

  const token = safeTokenForAuthHeader(data?.token || "");
  if (token) setAccessToken(token);

  return {
    user: data?.user || null,
    session: null,
    token,
    emailConfirmationRequired: false,
    message: "Conta criada com sucesso."
  };
}

async function requestBackendForgotPassword(payload: any) {
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl) throw authError("Backend nao configurado para recuperar senha.");

  const response = await fetch(`${apiBaseUrl}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: String(payload.email || "").trim()
    })
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw authError(data?.message || "Nao foi possivel enviar o link de recuperacao.");
  }

  return data || { message: "Se o email existir, enviaremos um link de redefinicao." };
}

async function requestBackendPasswordReset(payload: any) {
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl) throw authError("Backend nao configurado para redefinir senha.");

  const response = await fetch(`${apiBaseUrl}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: payload.token || "",
      password: payload.password || ""
    })
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw authError(data?.message || "Nao foi possivel redefinir a senha.");
  }

  return data || { message: "Senha atualizada com sucesso." };
}

async function requestBackendAcceptInvite(payload: any) {
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl) throw authError("Backend nao configurado para aceitar convites.");

  const currentToken = safeTokenForAuthHeader(getAccessToken() || "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (currentToken) headers.Authorization = `Bearer ${currentToken}`;

  const response = await fetch(`${apiBaseUrl}/workspace/invites/accept`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload || {})
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw authError(data?.message || "Nao foi possivel aceitar o convite.");
  }

  const token = safeTokenForAuthHeader(data?.token || "");
  if (token) setAccessToken(token);

  return {
    user: data?.user || null,
    session: null,
    token
  };
}

async function requestBackendSettingsUpdate(token: string, payload: any) {
  const safeToken = safeTokenForAuthHeader(token);
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl || !safeToken) return null;

  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${safeToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      businessType: payload.businessType,
      businessName: payload.businessName,
      businessLogo: payload.businessLogo,
      whatsappReminderEnabled: payload.whatsappReminderEnabled,
      whatsappReminderOffsetMinutes: payload.whatsappReminderOffsetMinutes,
      whatsappReminderMessage: payload.whatsappReminderMessage,
      whatsappReminderTestPhone: payload.whatsappReminderTestPhone,
      whatsappConfirmationMessage: payload.whatsappConfirmationMessage,
      appointmentNotificationsEnabled: payload.appointmentNotificationsEnabled,
      appointmentNotificationOffsetMinutes: payload.appointmentNotificationOffsetMinutes,
      businessTypeCustom: payload.businessTypeCustom,
      businessPhone: payload.businessPhone,
      businessCity: payload.businessCity,
      businessAddress: payload.businessAddress
    })
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw authError(data?.message || "Nao foi possivel atualizar configuracoes no backend.");
  }

  return data?.user || null;
}

async function requestBackendLogout(token: string) {
  const safeToken = safeTokenForAuthHeader(token);
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl || !safeToken) return;

  await fetch(`${apiBaseUrl}/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`
    }
  }).catch(() => null);
}

async function requestBackendDeleteAccount(token: string) {
  const safeToken = safeTokenForAuthHeader(token);
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl || !safeToken) return null;

  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${safeToken}`
    }
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw authError(data?.message || "Nao foi possivel excluir a conta.");
  }

  return data;
}

function metadataWithoutHeavyLogo(user: any, payload: any) {
  const current = user?.user_metadata || {};

  return {
    ...current,
    name: payload?.name ?? current.name ?? "",
    businessName: payload?.businessName ?? current.businessName ?? "",
    businessType: payload?.businessType ?? current.businessType ?? "",
    // Keep this empty in Supabase metadata to avoid oversized JWT in Authorization.
    businessLogo: ""
  };
}

async function refreshAndPersistToken(client: any) {
  const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
  if (refreshError) {
    const { data: currentSession } = await client.auth.getSession();
    const fallbackToken = currentSession.session?.access_token || "";
    if (fallbackToken) setAccessToken(fallbackToken);
    return fallbackToken;
  }

  const token = refreshed.session?.access_token || "";
  if (token) setAccessToken(token);
  return token;
}

async function maybeShrinkOversizedTokenSession(session: any) {
  if (!session?.access_token) return session;
  if (!isLikelyOversizedAuthToken(session.access_token)) return session;
  if (!session.user?.user_metadata?.businessLogo) return session;

  const client = requireSupabase();
  const { error } = await client.auth.updateUser({
    data: metadataWithoutHeavyLogo(session.user, session.user?.user_metadata || {})
  });

  if (error) return session;

  const { data: refreshed } = await client.auth.refreshSession();
  if (!refreshed?.session) return session;

  setAccessToken(refreshed.session.access_token || "");
  return refreshed.session;
}

async function enrichAuthResultWithBackend(result: any, authEvent = "") {
  const safeToken = safeTokenForAuthHeader(result?.token || "");
  if (!safeToken) return result;

  const backendUser = await requestBackendMe(safeToken, authEvent);
  if (!backendUser) return result;

  return {
    ...result,
    user: mergeUser(result.user, backendUser)
  };
}

export async function getSession() {
  const storedToken = safeTokenForAuthHeader(getAccessToken() || "");

  if (!supabase) {
    if (storedToken) {
      try {
        const backendUser = await requestBackendMe(storedToken);
        if (backendUser) {
          return { user: backendUser, session: null, token: storedToken };
        }
      } catch (error) {
        if (!isBackendAuthDeniedError(error)) throw error;
      }
    }
    clearAccessToken();
    return { user: null, session: null, token: "" };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw friendlyError(error, "Nao foi possivel restaurar a sessao.");

  if (!data.session) {
    if (storedToken) {
      try {
        const backendUser = await requestBackendMe(storedToken);
        if (backendUser) {
          return { user: backendUser, session: null, token: storedToken };
        }
      } catch (error) {
        if (!isBackendAuthDeniedError(error)) throw error;
      }
    }
    clearAccessToken();
    return { user: null, session: null, token: "" };
  }

  const safeSession = await maybeShrinkOversizedTokenSession(data.session);
  try {
    return await enrichAuthResultWithBackend(authResult({ session: safeSession, user: safeSession.user }));
  } catch (error) {
    if (!isBackendAuthDeniedError(error)) throw error;
    await clearRejectedSession(supabase);
    return { user: null, session: null, token: "" };
  }
}

export async function restoreSession() {
  return getSession();
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  if (!supabase) return () => {};

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const token = safeTokenForAuthHeader(session?.access_token || "");

    if (token) {
      setAccessToken(token);
    } else {
      clearAccessToken();
    }

    const normalizedSession = session
      ? {
          ...session,
          access_token: token
        }
      : null;

    callback(event, normalizedSession);
  });

  return () => data.subscription.unsubscribe();
}

export async function signIn(emailOrPayload: any, maybePassword?: string) {
  const payload = typeof emailOrPayload === "object"
    ? emailOrPayload
    : { email: emailOrPayload, password: maybePassword };

  let supabaseError = null;
  let supabaseClient = null;

  try {
    const client = requireSupabase();
    supabaseClient = client;
    const { data, error } = await client.auth.signInWithPassword({
      email: String(payload.email || "").trim(),
      password: payload.password || ""
    });

    if (error) throw friendlyError(error, "Email ou senha invalidos.");

    const safeSession = await maybeShrinkOversizedTokenSession(data.session);
    return enrichAuthResultWithBackend(
      authResult({ ...data, session: safeSession, user: safeSession?.user || data.user }),
      "login_success"
    );
  } catch (error) {
    if (isBackendAuthDeniedError(error)) {
      await clearRejectedSession(supabaseClient);
      throw error;
    }
    supabaseError = error;
  }

  try {
    const backendResult = await requestBackendLogin(payload);
    if (backendResult?.token) return backendResult;
  } catch {
    // Keep the Supabase-facing error when both strategies fail.
  }

  throw supabaseError;
}

export async function login(payload: any) {
  return signIn(payload);
}

export async function signUp(emailOrPayload: any, maybePassword?: string) {
  const payload = typeof emailOrPayload === "object"
    ? emailOrPayload
    : { email: emailOrPayload, password: maybePassword };

  if (shouldUseBackendAuthOnly()) {
    return requestBackendRegister(payload);
  }

  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: String(payload.email || "").trim(),
    password: payload.password || "",
    options: {
      data: {
        name: payload.name || "",
        businessName: payload.businessName || "",
        businessType: payload.businessType || "",
        businessLogo: ""
      },
      emailRedirectTo: getLoginRedirectUrl()
    }
  });

  if (error) throw friendlyError(error, "Nao foi possivel criar a conta.");

  const safeSession = await maybeShrinkOversizedTokenSession(data.session);
  const result = await enrichAuthResultWithBackend(
    authResult({ ...data, session: safeSession, user: safeSession?.user || data.user }),
    "register"
  );

  return {
    ...result,
    emailConfirmationRequired: Boolean(data.user && !data.session),
    message: data.session
      ? "Conta criada com sucesso."
      : "Conta criada. Verifique seu email para confirmar o acesso."
  };
}

export async function register(payload: any) {
  return signUp(payload);
}

export async function acceptInvite(payload: any) {
  return requestBackendAcceptInvite(payload);
}

export async function signOut() {
  if (!supabase) {
    await requestBackendLogout(getAccessToken() || "");
    clearAccessToken();
    return;
  }

  const { data: currentSessionData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  await requestBackendLogout(currentSessionData.session?.access_token || "");

  const { error } = await supabase.auth.signOut();
  clearAccessToken();
  if (error) throw friendlyError(error, "Nao foi possivel sair.");
}

export async function logout() {
  return signOut();
}

export async function deleteAccount() {
  if (shouldUseBackendAuthOnly()) {
    await requestBackendDeleteAccount(getAccessToken() || "");
    clearAccessToken();
    return { ok: true };
  }

  const client = requireSupabase();
  const { data: currentSessionData } = await client.auth.getSession();
  await requestBackendDeleteAccount(currentSessionData.session?.access_token || "");
  await client.auth.signOut().catch(() => null);
  clearAccessToken();
  return { ok: true };
}

export async function resetPassword(emailOrPayload: any) {
  const email = typeof emailOrPayload === "object" ? emailOrPayload.email : emailOrPayload;

  if (shouldUseBackendAuthOnly()) {
    return requestBackendForgotPassword({ email });
  }

  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(String(email || "").trim(), {
    redirectTo: env.supabaseResetPasswordRedirectUrl
  });

  if (error) throw friendlyError(error, "Nao foi possivel enviar o email de recuperacao.");

  return {
    message: "Enviamos um link para redefinir sua senha."
  };
}

export async function forgotPassword(payload: any) {
  return resetPassword(payload);
}

export async function resendConfirmation(emailOrPayload: any) {
  const client = requireSupabase();
  const email = typeof emailOrPayload === "object" ? emailOrPayload.email : emailOrPayload;
  const { error } = await client.auth.resend({
    type: "signup",
    email: String(email || "").trim(),
    options: {
      emailRedirectTo: getLoginRedirectUrl()
    }
  });

  if (error) throw friendlyError(error, "Nao foi possivel reenviar o email de confirmacao.");

  return {
    message: "Reenviamos o email de confirmacao. Verifique sua caixa de entrada e a pasta de spam."
  };
}

export async function applyPasswordResetSessionFromUrl(urlValue = window.location.href) {
  const url = new URL(urlValue, window.location.origin);
  const code = url.searchParams.get("code");
  const token = url.searchParams.get("token") || "";

  if (shouldUseBackendAuthOnly()) {
    return token
      ? { ready: true, token }
      : { ready: false, message: "Link de redefinicao sem token valido." };
  }

  const client = requireSupabase();

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw friendlyError(error, "Nao foi possivel validar o link de redefinicao.");
    return { ready: true };
  }

  const hashParams = new URLSearchParams((url.hash || "").replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return { ready: false, message: "Link de redefinicao sem token valido." };
  }

  const { error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error) throw friendlyError(error, "Nao foi possivel validar o link de redefinicao.");
  return { ready: true };
}

export function getPasswordResetTokenFromUrl(urlValue = window.location.href) {
  const url = new URL(urlValue, window.location.origin);
  return url.searchParams.get("token") || url.searchParams.get("code") || "";
}

export async function updatePassword(newPasswordOrPayload: any) {
  if (shouldUseBackendAuthOnly()) {
    const payload = typeof newPasswordOrPayload === "object"
      ? newPasswordOrPayload
      : { password: newPasswordOrPayload };
    return requestBackendPasswordReset(payload);
  }

  const client = requireSupabase();
  const password = typeof newPasswordOrPayload === "object"
    ? newPasswordOrPayload.password
    : newPasswordOrPayload;

  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw friendlyError(error, "Nao foi possivel atualizar a senha.");

  return await enrichAuthResultWithBackend({
    ...authResult(data),
    message: "Senha atualizada com sucesso."
  });
}

export async function updateUserSettings(payload: any) {
  if (shouldUseBackendAuthOnly()) {
    const backendUser = await requestBackendSettingsUpdate(getAccessToken() || "", payload);
    return { user: backendUser };
  }

  const client = requireSupabase();
  const { data: currentSessionData } = await client.auth.getSession();
  const currentUser = currentSessionData.session?.user || null;

  const { data, error } = await client.auth.updateUser({
    data: metadataWithoutHeavyLogo(currentUser, payload)
  });

  if (error) throw friendlyError(error, "Nao foi possivel atualizar configuracoes.");

  const token = await refreshAndPersistToken(client);
  const backendUser = await requestBackendSettingsUpdate(token, payload);

  return {
    user: mergeUser(publicSupabaseUser(data.user), backendUser)
  };
}

export function saveAuthToken(token: string) {
  setAccessToken(token);
}
