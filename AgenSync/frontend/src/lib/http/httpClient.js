import { ApiError } from "./ApiError.js";
import { buildQueryString } from "./buildQueryString.js";

function resolveUrl(baseURL, path, params) {
  const safeBase = String(baseURL || "").replace(/\/$/, "");
  const safePath = String(path || "").startsWith("/") ? path : `/${String(path || "")}`;
  return `${safeBase}${safePath}${buildQueryString(params)}`;
}

function defaultMessageByStatus(status) {
  if (status === 401) return "Sua sessao expirou. Faca login novamente.";
  if (status === 403) return "Voce nao tem permissao para esta acao.";
  if (status === 404) return "Recurso nao encontrado.";
  if (status >= 500) return "Servico temporariamente indisponivel.";
  return "Nao foi possivel concluir a operacao.";
}

function httpDebug(label, data = {}) {
  if (import.meta.env.VITE_AUTH_DEBUG !== "1") return;
  // eslint-disable-next-line no-console
  console.info(`[HTTP_DEBUG] ${label}`, data);
}

function hashKey(value) {
  let hash = 5381;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33) ^ text.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

export function createHttpClient({
  baseURL,
  defaultHeaders = { "Content-Type": "application/json" },
  defaultGetCacheTtlMs = 15_000,
  maxCacheEntries = 300,
  getAuthToken,
  onUnauthorized
} = {}) {
  const requestInterceptors = [];
  const responseInterceptors = [];
  const responseCache = new Map();
  const inflightRequests = new Map();
  const persistentCachePrefix = "agensync_http_cache_v1:";

  function buildCacheKey(url, authHeader) {
    return `${authHeader || "public"}:${url}`;
  }

  function persistentCacheKey(key) {
    return `${persistentCachePrefix}${hashKey(key)}`;
  }

  function getPersistentCachedResponse(key) {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    try {
      const cached = JSON.parse(window.sessionStorage.getItem(persistentCacheKey(key)) || "null");
      if (!cached || cached.expiresAt <= Date.now()) {
        window.sessionStorage.removeItem(persistentCacheKey(key));
        return null;
      }
      responseCache.set(key, {
        value: cached.value,
        expiresAt: cached.expiresAt
      });
      return cached.value;
    } catch {
      return null;
    }
  }

  function getCachedResponse(key) {
    const cached = responseCache.get(key);
    if (!cached || cached.expiresAt <= Date.now()) {
      responseCache.delete(key);
      return getPersistentCachedResponse(key);
    }
    return cached.value;
  }

  function setCachedResponse(key, value, ttlMs) {
    const expiresAt = Date.now() + ttlMs;
    if (responseCache.size >= maxCacheEntries) {
      const oldestKey = responseCache.keys().next().value;
      if (oldestKey) responseCache.delete(oldestKey);
    }

    responseCache.set(key, {
      value,
      expiresAt
    });

    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(persistentCacheKey(key), JSON.stringify({ value, expiresAt }));
      } catch {
        // Session storage can be full or unavailable; memory cache still works.
      }
    }
  }

  function clearResponseCache() {
    responseCache.clear();
    inflightRequests.clear();
    if (typeof window !== "undefined") {
      try {
        Object.keys(window.sessionStorage || {})
          .filter((key) => key.startsWith(persistentCachePrefix))
          .forEach((key) => window.sessionStorage.removeItem(key));
      } catch {
        // Ignore storage cleanup failures.
      }
      window.dispatchEvent(new Event("agensync:http-cache-cleared"));
    }
  }

  async function request(path, options = {}) {
    const {
      method = "GET",
      params,
      headers = {},
      body,
      rawBody = false,
      omitAuth = false,
      cacheTtlMs,
      ...rest
    } = options;
    const requestHeaders = { ...defaultHeaders, ...headers };
    const token = omitAuth ? "" : getAuthToken?.();
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
    httpDebug("request", {
      path,
      method,
      omitAuth: Boolean(omitAuth),
      hasAuthorization: Boolean(requestHeaders.Authorization)
    });

    const config = {
      method,
      headers: requestHeaders,
      ...rest
    };

    if (body !== undefined) {
      if (rawBody) {
        config.body = body;
      } else {
        config.body = JSON.stringify(body);
      }
    }

    const context = { path, config };
    for (const interceptor of requestInterceptors) {
      await interceptor(context);
    }

    const url = resolveUrl(baseURL, context.path, params);
    const requestMethod = String(context.config.method || method).toUpperCase();
    const canShareInflight = requestMethod === "GET";
    const effectiveCacheTtlMs =
      canShareInflight && cacheTtlMs !== 0
        ? Number(cacheTtlMs ?? defaultGetCacheTtlMs)
        : 0;
    const canUseCache = canShareInflight && effectiveCacheTtlMs > 0;
    const cacheKey = canShareInflight ? buildCacheKey(url, requestHeaders.Authorization) : "";

    if (canShareInflight) {
      const cached = getCachedResponse(cacheKey);
      if (cached) return cached;
      const inflight = inflightRequests.get(cacheKey);
      if (inflight) return inflight;
    }

    let response;

    const executeRequest = async () => {
      try {
        response = await fetch(url, context.config);
      } catch (error) {
        throw new ApiError({
          message: "Falha de conexao com o backend. Verifique sua internet ou API.",
          code: "NETWORK_ERROR",
          cause: error
        });
      }

      const text = await response.text();
      let payload = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }

      if (!response.ok) {
        const apiError = new ApiError({
          status: response.status,
          code: payload?.code || "",
          details: payload,
          message: payload?.message || defaultMessageByStatus(response.status)
        });
        httpDebug("response_error", {
          path,
          method: requestMethod,
          status: response.status,
          code: payload?.details?.code || payload?.code || ""
        });

        if (response.status === 401) {
          onUnauthorized?.(apiError);
        }

        throw apiError;
      }

      let result = payload;
      for (const interceptor of responseInterceptors) {
        result = await interceptor(result, response);
      }

      if (canUseCache) {
        setCachedResponse(cacheKey, result, effectiveCacheTtlMs);
      } else if (requestMethod !== "GET") {
        clearResponseCache();
      }

      return result;
    };

    if (!canShareInflight) return executeRequest();

    const requestPromise = executeRequest().finally(() => {
      inflightRequests.delete(cacheKey);
    });
    inflightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: "GET" }),
    post: (path, options) => request(path, { ...options, method: "POST" }),
    put: (path, options) => request(path, { ...options, method: "PUT" }),
    patch: (path, options) => request(path, { ...options, method: "PATCH" }),
    delete: (path, options) => request(path, { ...options, method: "DELETE" }),
    clearCache: clearResponseCache,
    useRequestInterceptor: (interceptor) => {
      requestInterceptors.push(interceptor);
      return () => {
        const index = requestInterceptors.indexOf(interceptor);
        if (index >= 0) requestInterceptors.splice(index, 1);
      };
    },
    useResponseInterceptor: (interceptor) => {
      responseInterceptors.push(interceptor);
      return () => {
        const index = responseInterceptors.indexOf(interceptor);
        if (index >= 0) responseInterceptors.splice(index, 1);
      };
    }
  };
}
