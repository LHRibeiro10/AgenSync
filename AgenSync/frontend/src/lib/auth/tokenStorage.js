import { env } from "../../config/env.js";

const MAX_SAFE_AUTH_HEADER_TOKEN_LENGTH = 6000;

function hasWindow() {
  return typeof window !== "undefined";
}

function getSessionStorage() {
  return hasWindow() ? window.sessionStorage : null;
}

function getLocalStorage() {
  return hasWindow() ? window.localStorage : null;
}

function readToken(storage) {
  if (!storage) return "";
  return storage.getItem(env.tokenStorageKey) || "";
}

function writeToken(storage, token) {
  if (!storage) return;
  if (!token) {
    storage.removeItem(env.tokenStorageKey);
    return;
  }
  storage.setItem(env.tokenStorageKey, token);
}

function clearTokenEverywhere() {
  writeToken(getSessionStorage(), "");
  writeToken(getLocalStorage(), "");
}

function isOversizedToken(token) {
  return String(token || "").length > MAX_SAFE_AUTH_HEADER_TOKEN_LENGTH;
}

export function getAccessToken() {
  const sessionStorage = getSessionStorage();
  const localStorage = getLocalStorage();

  const sessionToken = readToken(sessionStorage);
  if (sessionToken) {
    if (isOversizedToken(sessionToken)) {
      clearTokenEverywhere();
      return "";
    }
    return sessionToken;
  }

  const legacyLocalToken = readToken(localStorage);
  if (!legacyLocalToken) return "";

  if (isOversizedToken(legacyLocalToken)) {
    clearTokenEverywhere();
    return "";
  }

  // Migrate legacy token from localStorage to sessionStorage (logout on tab close).
  writeToken(sessionStorage, legacyLocalToken);
  writeToken(localStorage, "");
  return legacyLocalToken;
}

export function setAccessToken(token) {
  const sessionStorage = getSessionStorage();
  const localStorage = getLocalStorage();
  if (!token) {
    clearTokenEverywhere();
    return;
  }

  // Keep auth token scoped to current browser tab/session.
  writeToken(sessionStorage, token);
  // Remove legacy persistent token to avoid stale oversized headers.
  writeToken(localStorage, "");
}

export function clearAccessToken() {
  clearTokenEverywhere();
}
