import {
  createProfessionalApi,
  deleteProfessionalApi,
  listProfessionalsApi,
  updateProfessionalApi
} from "../api/modules/professionalsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

export function listProfessionals(params) {
  return executeDataSource({
    feature: "professionals.list",
    remote: () => listProfessionalsApi(params)
  });
}

export function createProfessional(payload) {
  return executeDataSource({
    feature: "professionals.create",
    remote: () => createProfessionalApi(payload)
  });
}

export function updateProfessional(professionalId, payload) {
  return executeDataSource({
    feature: "professionals.update",
    remote: () => updateProfessionalApi(professionalId, payload)
  });
}

export function deleteProfessional(professionalId) {
  return executeDataSource({
    feature: "professionals.delete",
    remote: () => deleteProfessionalApi(professionalId)
  });
}
