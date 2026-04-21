import {
  createClientApi,
  deleteClientApi,
  listClientsApi,
  updateClientApi
} from "../api/modules/clientsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

export function listClients(params) {
  return executeDataSource({
    feature: "clients.list",
    remote: () => listClientsApi(params)
  });
}

export function createClient(payload) {
  return executeDataSource({
    feature: "clients.create",
    remote: () => createClientApi(payload)
  });
}

export function updateClient(clientId, payload) {
  return executeDataSource({
    feature: "clients.update",
    remote: () => updateClientApi(clientId, payload)
  });
}

export function deleteClient(clientId) {
  return executeDataSource({
    feature: "clients.delete",
    remote: () => deleteClientApi(clientId)
  });
}
