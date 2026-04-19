import { env } from "../../config/env.js";
import { ApiError } from "../../lib/http/ApiError.js";

export function shouldFallbackToMock(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || "");
  return code === "NETWORK_ERROR" || status === 404 || status === 405 || status === 501;
}

export async function executeDataSource({ feature, remote, mock, forceRemote = false }) {
  const shouldUseRemote = forceRemote || env.dataMode === "remote";
  if (!shouldUseRemote || !remote) {
    if (!mock) throw new Error(`Fonte local nao disponivel para ${feature}.`);
    return mock();
  }

  try {
    return await remote();
  } catch (error) {
    if (mock && env.mockFallbackEnabled && shouldFallbackToMock(error)) {
      console.warn(`[AgenSync] Fallback para mock em ${feature}.`, error);
      return mock();
    }
    throw error;
  }
}

export function missingRemoteFeature(feature) {
  throw new ApiError({
    status: 501,
    message: `${feature} ainda nao disponivel no backend real.`
  });
}
