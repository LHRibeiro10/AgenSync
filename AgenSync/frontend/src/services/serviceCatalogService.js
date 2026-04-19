import {
  createServiceApi,
  deleteServiceApi,
  listServicesApi,
  updateServiceApi
} from "../api/modules/servicesApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";
import { localCoreMockApi } from "../mocks/localApi/coreMockApi.js";

export function listServices(params) {
  return executeDataSource({
    feature: "services.list",
    remote: () => listServicesApi(params),
    mock: () => localCoreMockApi.listServices(params)
  });
}

export function createService(payload) {
  return executeDataSource({
    feature: "services.create",
    remote: () => createServiceApi(payload),
    mock: () => localCoreMockApi.createService(payload)
  });
}

export function updateService(serviceId, payload) {
  return executeDataSource({
    feature: "services.update",
    remote: () => updateServiceApi(serviceId, payload),
    mock: () => localCoreMockApi.updateService(serviceId, payload)
  });
}

export function deleteService(serviceId) {
  return executeDataSource({
    feature: "services.delete",
    remote: () => deleteServiceApi(serviceId),
    mock: () => localCoreMockApi.deleteService(serviceId)
  });
}
