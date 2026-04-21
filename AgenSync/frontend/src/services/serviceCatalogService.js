import {
  createServiceApi,
  deleteServiceApi,
  listServicesApi,
  updateServiceApi
} from "../api/modules/servicesApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

export function listServices(params) {
  return executeDataSource({
    feature: "services.list",
    remote: () => listServicesApi(params)
  });
}

export function createService(payload) {
  return executeDataSource({
    feature: "services.create",
    remote: () => createServiceApi(payload)
  });
}

export function updateService(serviceId, payload) {
  return executeDataSource({
    feature: "services.update",
    remote: () => updateServiceApi(serviceId, payload)
  });
}

export function deleteService(serviceId) {
  return executeDataSource({
    feature: "services.delete",
    remote: () => deleteServiceApi(serviceId)
  });
}
