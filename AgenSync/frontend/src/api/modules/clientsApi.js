import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function listClientsApi(params) {
  return httpClient.get(endpoints.clients.list, { params, cacheTtlMs: 30_000 });
}

export function createClientApi(payload) {
  return httpClient.post(endpoints.clients.list, { body: payload });
}

export function updateClientApi(clientId, payload) {
  return httpClient.put(endpoints.clients.byId(clientId), { body: payload });
}

export function deleteClientApi(clientId) {
  return httpClient.delete(endpoints.clients.byId(clientId));
}
