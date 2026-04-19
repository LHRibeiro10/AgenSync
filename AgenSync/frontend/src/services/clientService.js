import {
  createClientApi,
  deleteClientApi,
  listClientsApi,
  updateClientApi
} from "../api/modules/clientsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";
import { localCoreMockApi } from "../mocks/localApi/coreMockApi.js";

export function listClients(params) {
  return executeDataSource({
    feature: "clients.list",
    remote: () => listClientsApi(params),
    mock: () => localCoreMockApi.listClients(params)
  });
}

export function createClient(payload) {
  return executeDataSource({
    feature: "clients.create",
    remote: () => createClientApi(payload),
    mock: () => localCoreMockApi.createClient(payload)
  });
}

export function updateClient(clientId, payload) {
  return executeDataSource({
    feature: "clients.update",
    remote: () => updateClientApi(clientId, payload),
    mock: () => localCoreMockApi.updateClient(clientId, payload)
  });
}

export function deleteClient(clientId) {
  return executeDataSource({
    feature: "clients.delete",
    remote: () => deleteClientApi(clientId),
    mock: () => localCoreMockApi.deleteClient(clientId)
  });
}
