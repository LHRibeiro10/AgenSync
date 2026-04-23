import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function listServicesApi(params) {
  return httpClient.get(endpoints.services.list, { params, cacheTtlMs: 30_000 });
}

export function createServiceApi(payload) {
  return httpClient.post(endpoints.services.list, { body: payload });
}

export function updateServiceApi(serviceId, payload) {
  return httpClient.put(endpoints.services.byId(serviceId), { body: payload });
}

export function deleteServiceApi(serviceId) {
  return httpClient.delete(endpoints.services.byId(serviceId));
}
