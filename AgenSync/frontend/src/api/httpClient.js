import { env } from "../config/env.js";
import { clearAccessToken, getAccessToken } from "../lib/auth/tokenStorage.js";
import { createHttpClient } from "../lib/http/httpClient.js";

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === "function" ? handler : null;
}

function handleUnauthorized(error) {
  clearAccessToken();
  httpClient.clearCache?.();
  if (unauthorizedHandler) unauthorizedHandler(error);
}

export const httpClient = createHttpClient({
  baseURL: env.apiUrl,
  getAuthToken: getAccessToken,
  onUnauthorized: handleUnauthorized
});
