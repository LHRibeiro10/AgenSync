import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function listDocumentsApi(params) {
  return httpClient.get(endpoints.documents.list, { params });
}

export function createDocumentApi(payload) {
  return httpClient.post(endpoints.documents.list, { body: payload });
}

export function updateDocumentApi(documentId, payload) {
  return httpClient.put(endpoints.documents.byId(documentId), { body: payload });
}

export function deleteDocumentApi(documentId) {
  return httpClient.delete(endpoints.documents.byId(documentId));
}

export function signDocumentApi(documentId, payload) {
  return httpClient.post(`${endpoints.documents.byId(documentId)}/sign`, { body: payload });
}
