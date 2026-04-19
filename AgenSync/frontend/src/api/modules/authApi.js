import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function loginApi(payload) {
  return httpClient.post(endpoints.auth.login, { body: payload, omitAuth: true });
}

export function registerApi(payload) {
  return httpClient.post(endpoints.auth.register, { body: payload, omitAuth: true });
}

export function meApi() {
  return httpClient.get(endpoints.auth.me);
}

export function updateMeApi(payload) {
  return httpClient.put(endpoints.auth.me, { body: payload });
}

export function forgotPasswordApi(payload) {
  return httpClient.post(endpoints.auth.forgotPassword, { body: payload, omitAuth: true });
}

export function resetPasswordApi(payload) {
  return httpClient.post(endpoints.auth.resetPassword, { body: payload, omitAuth: true });
}
