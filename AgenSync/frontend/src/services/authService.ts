import { env } from "../config/env.js";
import { clearAccessToken, setAccessToken } from "../lib/auth/tokenStorage.js";
import { supabase } from "../lib/supabase.ts";

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
  const token = session?.access_token || "";

  if (token) setAccessToken(token);

  return { user, session, token };
}

function authError(message: string, code?: string) {
  const next = new Error(message) as Error & { code?: string };
  if (code) next.code = code;
  return next;
}

function friendlyError(error: any, fallback: string) {
  if (!error) return authError(fallback);
  const message = String(error.message || "");

  if (/failed to fetch|fetch failed|network/i.test(message)) {
    return authError("Não foi possível conectar ao Supabase. Verifique VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e sua conexão.", "NETWORK_ERROR");
  }

  if (/email not confirmed|email_not_confirmed/i.test(message)) {
    return authError(
      "Seu email ainda não foi confirmado. Confira sua caixa de entrada ou reenvie o email de confirmação.",
      "EMAIL_NOT_CONFIRMED"
    );
  }

  if (/invalid login credentials/i.test(message)) {
    return authError("Email ou senha inválidos.", "INVALID_CREDENTIALS");
  }

  return authError(error.message || fallback);
}

function getLoginRedirectUrl() {
  return env.supabaseResetPasswordRedirectUrl.replace(/\/reset-password\/?$/, "/login");
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw friendlyError(error, "Não foi possível restaurar a sessão.");

  if (!data.session) {
    clearAccessToken();
    return { user: null, session: null, token: "" };
  }

  return authResult(data);
}

export async function restoreSession() {
  return getSession();
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      setAccessToken(session.access_token);
    } else {
      clearAccessToken();
    }
    callback(event, session);
  });

  return () => data.subscription.unsubscribe();
}

export async function signIn(emailOrPayload: any, maybePassword?: string) {
  const payload = typeof emailOrPayload === "object"
    ? emailOrPayload
    : { email: emailOrPayload, password: maybePassword };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(payload.email || "").trim(),
    password: payload.password || ""
  });

  if (error) throw friendlyError(error, "Email ou senha inválidos.");
  return authResult(data);
}

export async function login(payload: any) {
  return signIn(payload);
}

export async function signUp(emailOrPayload: any, maybePassword?: string) {
  const payload = typeof emailOrPayload === "object"
    ? emailOrPayload
    : { email: emailOrPayload, password: maybePassword };

  const { data, error } = await supabase.auth.signUp({
    email: String(payload.email || "").trim(),
    password: payload.password || "",
    options: {
      data: {
        name: payload.name || "",
        businessName: payload.businessName || "",
        businessType: payload.businessType || "",
        businessLogo: payload.businessLogo || ""
      },
      emailRedirectTo: getLoginRedirectUrl()
    }
  });

  if (error) throw friendlyError(error, "Não foi possível criar a conta.");

  const result = authResult(data);
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

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  clearAccessToken();
  if (error) throw friendlyError(error, "Não foi possível sair.");
}

export async function logout() {
  return signOut();
}

export async function resetPassword(emailOrPayload: any) {
  const email = typeof emailOrPayload === "object" ? emailOrPayload.email : emailOrPayload;
  const { error } = await supabase.auth.resetPasswordForEmail(String(email || "").trim(), {
    redirectTo: env.supabaseResetPasswordRedirectUrl
  });

  if (error) throw friendlyError(error, "Não foi possível enviar o email de recuperação.");

  return {
    message: "Enviamos um link para redefinir sua senha."
  };
}

export async function forgotPassword(payload: any) {
  return resetPassword(payload);
}

export async function resendConfirmation(emailOrPayload: any) {
  const email = typeof emailOrPayload === "object" ? emailOrPayload.email : emailOrPayload;
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: String(email || "").trim(),
    options: {
      emailRedirectTo: getLoginRedirectUrl()
    }
  });

  if (error) throw friendlyError(error, "Não foi possível reenviar o email de confirmação.");

  return {
    message: "Reenviamos o email de confirmação. Verifique sua caixa de entrada e a pasta de spam."
  };
}

export async function applyPasswordResetSessionFromUrl(urlValue = window.location.href) {
  const url = new URL(urlValue, window.location.origin);
  const code = url.searchParams.get("code");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw friendlyError(error, "Não foi possível validar o link de redefinição.");
    return { ready: true };
  }

  const hashParams = new URLSearchParams((url.hash || "").replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return { ready: false, message: "Link de redefinição sem token válido." };
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error) throw friendlyError(error, "Não foi possível validar o link de redefinição.");
  return { ready: true };
}

export function getPasswordResetTokenFromUrl(urlValue = window.location.href) {
  const url = new URL(urlValue, window.location.origin);
  return url.searchParams.get("token") || url.searchParams.get("code") || "";
}

export async function updatePassword(newPasswordOrPayload: any) {
  const password = typeof newPasswordOrPayload === "object"
    ? newPasswordOrPayload.password
    : newPasswordOrPayload;

  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw friendlyError(error, "Não foi possível atualizar a senha.");

  return {
    ...authResult(data),
    message: "Senha atualizada com sucesso."
  };
}

export async function updateUserSettings(payload: any) {
  const { data, error } = await supabase.auth.updateUser({
    data: {
      name: payload.name,
      businessName: payload.businessName,
      businessType: payload.businessType,
      businessLogo: payload.businessLogo
    }
  });

  if (error) throw friendlyError(error, "Não foi possível atualizar configurações.");
  return { user: publicSupabaseUser(data.user) };
}

export function saveAuthToken(token: string) {
  setAccessToken(token);
}
