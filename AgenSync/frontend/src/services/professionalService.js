import {
  createProfessionalApi,
  deleteProfessionalApi,
  listProfessionalsApi,
  updateProfessionalApi
} from "../api/modules/professionalsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";
import { localCoreMockApi } from "../mocks/localApi/coreMockApi.js";

export function listProfessionals(params) {
  return executeDataSource({
    feature: "professionals.list",
    remote: () => listProfessionalsApi(params),
    mock: () => localCoreMockApi.listProfessionals(params)
  });
}

export function createProfessional(payload) {
  return executeDataSource({
    feature: "professionals.create",
    remote: () => createProfessionalApi(payload),
    mock: () => localCoreMockApi.createProfessional(payload)
  });
}

export function updateProfessional(professionalId, payload) {
  return executeDataSource({
    feature: "professionals.update",
    remote: () => updateProfessionalApi(professionalId, payload),
    mock: () => localCoreMockApi.updateProfessional(professionalId, payload)
  });
}

export function deleteProfessional(professionalId) {
  return executeDataSource({
    feature: "professionals.delete",
    remote: () => deleteProfessionalApi(professionalId),
    mock: () => localCoreMockApi.deleteProfessional(professionalId)
  });
}
