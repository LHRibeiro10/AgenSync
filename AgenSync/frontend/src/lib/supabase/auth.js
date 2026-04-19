import { env } from "../../config/env.js";
import { ApiError } from "../http/ApiError.js";
import { getSupabaseClient } from "./client.js";

function ensureClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new ApiError({
      message: "Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
    });
  }
  return client;
}

function normalizeSupabaseError(error, fallbackMessage) {
  if (!error) return null;
  return new ApiError({
    message: error.message || fallbackMessage || "Erro ao comunicar com Supabase.",
    code: error.code || "SUPABASE_ERROR",
    details: error
  });
}

function publicSupabaseUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.user_metadata?.name || user.email || "Usuario",
    email: user.email || "",
    businessName: user.user_metadata?.businessName || "",
    businessLogo: user.user_metadata?.businessLogo || "",
    businessType: user.user_metadata?.businessType || "",
    createdAt: user.created_at || new Date().toISOString()
  };
}

function parseTokenValue(source, key) {
  const fromQuery = source.searchParams.get(key);
  if (fromQuery) return fromQuery;

  const hashParams = new URLSearchParams((source.hash || "").replace(/^#/, ""));
  return hashParams.get(key) || "";
}

export async function supabaseLogin(payload) {
  const client = ensureClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: payload.email,
    password: payload.password
  });
  if (error) throw normalizeSupabaseError(error, "Nao foi possivel fazer login.");
  return { user: publicSupabaseUser(data.user), session: data.session };
}

export async function supabaseRegister(payload) {
  const client = ensureClient();
  const { data, error } = await client.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        name: payload.name || "",
        businessName: payload.businessName || "",
        businessType: payload.businessType || "",
        businessLogo: payload.businessLogo || ""
      }
    }
  });
  if (error) throw normalizeSupabaseError(error, "Nao foi possivel criar a conta.");
  return { user: publicSupabaseUser(data.user), session: data.session };
}

export async function supabaseGetSessionUser() {
  const client = ensureClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw normalizeSupabaseError(error, "Nao foi possivel validar a sessao.");
  return { user: publicSupabaseUser(data.user) };
}

export async function supabaseLogout() {
  const client = ensureClient();
  const { error } = await client.auth.signOut();
  if (error) throw normalizeSupabaseError(error, "Nao foi possivel encerrar sessao.");
}

export async function supabaseForgotPassword(email) {
  const client = ensureClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: env.supabaseResetPasswordRedirectUrl
  });
  if (error) throw normalizeSupabaseError(error, "Nao foi possivel enviar o email de recuperacao.");
  return {
    message: "Se o email existir, enviaremos um link de redefinicao.",
    resetUrl: env.supabaseResetPasswordRedirectUrl
  };
}

export async function supabaseApplyRecoverySession(urlValue) {
  const client = ensureClient();
  const safeUrl = new URL(urlValue, window.location.origin);
  const accessToken = parseTokenValue(safeUrl, "access_token");
  const refreshToken = parseTokenValue(safeUrl, "refresh_token");

  if (!accessToken || !refreshToken) {
    return { ready: false, message: "Link de redefinicao sem token valido." };
  }

  const { error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  if (error) throw normalizeSupabaseError(error, "Nao foi possivel validar o link de redefinicao.");

  return { ready: true };
}

export async function supabaseResetPassword(password) {
  const client = ensureClient();
  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw normalizeSupabaseError(error, "Nao foi possivel atualizar a senha.");
  return { user: publicSupabaseUser(data.user), message: "Senha atualizada com sucesso." };
}
