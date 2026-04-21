import { ApiError } from "../../lib/http/ApiError.js";

export async function executeDataSource({ feature, remote }) {
  if (!remote) {
    throw new Error(`Fonte remota nao disponivel para ${feature}.`);
  }
  return remote();
}

export function missingRemoteFeature(feature) {
  throw new ApiError({
    status: 501,
    message: `${feature} ainda nao disponivel no backend real.`
  });
}
