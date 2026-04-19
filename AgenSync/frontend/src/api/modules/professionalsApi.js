import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function listProfessionalsApi(params) {
  return httpClient.get(endpoints.professionals.list, { params });
}

export function createProfessionalApi(payload) {
  return httpClient.post(endpoints.professionals.list, { body: payload });
}

export function updateProfessionalApi(professionalId, payload) {
  return httpClient.put(endpoints.professionals.byId(professionalId), { body: payload });
}

export function deleteProfessionalApi(professionalId) {
  return httpClient.delete(endpoints.professionals.byId(professionalId));
}
