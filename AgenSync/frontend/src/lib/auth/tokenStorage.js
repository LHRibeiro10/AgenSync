import { env } from "../../config/env.js";

function hasStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function getAccessToken() {
  if (!hasStorage()) return "";
  return window.localStorage.getItem(env.tokenStorageKey) || "";
}

export function setAccessToken(token) {
  if (!hasStorage()) return;
  if (!token) {
    window.localStorage.removeItem(env.tokenStorageKey);
    return;
  }
  window.localStorage.setItem(env.tokenStorageKey, token);
}

export function clearAccessToken() {
  if (!hasStorage()) return;
  window.localStorage.removeItem(env.tokenStorageKey);
}
