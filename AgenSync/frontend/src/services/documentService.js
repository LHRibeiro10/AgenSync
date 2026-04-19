import {
  createBudgetApi,
  signBudgetApi
} from "../api/modules/budgetsApi.js";
import {
  createDocumentApi,
  deleteDocumentApi,
  signDocumentApi,
  updateDocumentApi
} from "../api/modules/documentsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";
import * as clientCareMock from "../mocks/legacy/clientCareMock.js";

function asItem(value, key) {
  if (value?.[key]) return value[key];
  return value;
}

export const emptyAnamnesis = clientCareMock.emptyAnamnesis;

export function getClientCare(clientId) {
  return clientCareMock.getClientCare(clientId);
}

export function saveClientAnamnesis(clientId, payload) {
  return clientCareMock.saveClientAnamnesis(clientId, payload);
}

export async function createClientDocument(clientId, payload) {
  const response = await executeDataSource({
    feature: "documents.create",
    remote: () => createDocumentApi({ clientId, ...payload }),
    mock: () => clientCareMock.createClientDocument(clientId, payload)
  });
  return asItem(response, "document");
}

export async function updateClientDocument(clientId, documentId, payload) {
  const response = await executeDataSource({
    feature: "documents.update",
    remote: () => updateDocumentApi(documentId, { clientId, ...payload }),
    mock: () => clientCareMock.updateClientDocument(clientId, documentId, payload)
  });
  return asItem(response, "document");
}

export async function deleteClientDocument(clientId, documentId) {
  const response = await executeDataSource({
    feature: "documents.delete",
    remote: () => deleteDocumentApi(documentId),
    mock: () => clientCareMock.deleteClientDocument(clientId, documentId)
  });
  return asItem(response, "document");
}

export async function signClientDocument(clientId, documentId, signatureImage) {
  const response = await executeDataSource({
    feature: "documents.sign",
    remote: () => signDocumentApi(documentId, { clientId, signatureImage }),
    mock: () => clientCareMock.signClientDocument(clientId, documentId, signatureImage)
  });
  return asItem(response, "document");
}

export async function createClientBudget(clientId, payload) {
  const response = await executeDataSource({
    feature: "budgets.create",
    remote: () => createBudgetApi({ clientId, ...payload }),
    mock: () => clientCareMock.createClientBudget(clientId, payload)
  });
  return asItem(response, "budget");
}

export async function signClientBudget(clientId, budgetId, signatureImage) {
  const response = await executeDataSource({
    feature: "budgets.sign",
    remote: () => signBudgetApi(budgetId, { clientId, signatureImage }),
    mock: () => clientCareMock.signClientBudget(clientId, budgetId, signatureImage)
  });
  return asItem(response, "budget");
}

export function listFormTemplates() {
  return clientCareMock.listFormTemplates();
}

export function createFormTemplate(payload) {
  return clientCareMock.createFormTemplate(payload);
}

export function updateFormTemplate(templateId, payload) {
  return clientCareMock.updateFormTemplate(templateId, payload);
}

export function duplicateFormTemplate(templateId) {
  return clientCareMock.duplicateFormTemplate(templateId);
}

export function deleteFormTemplate(templateId) {
  return clientCareMock.deleteFormTemplate(templateId);
}

export function saveClientForm(clientId, payload) {
  return clientCareMock.saveClientForm(clientId, payload);
}

export function duplicateClientForm(clientId, formId) {
  return clientCareMock.duplicateClientForm(clientId, formId);
}

export function deleteClientForm(clientId, formId) {
  return clientCareMock.deleteClientForm(clientId, formId);
}

export function createClientEvolution(clientId, payload) {
  return clientCareMock.createClientEvolution(clientId, payload);
}

export function updateClientEvolution(clientId, evolutionId, payload) {
  return clientCareMock.updateClientEvolution(clientId, evolutionId, payload);
}

export function deleteClientEvolution(clientId, evolutionId) {
  return clientCareMock.deleteClientEvolution(clientId, evolutionId);
}

export function addClientPhotos(clientId, photos) {
  return clientCareMock.addClientPhotos(clientId, photos);
}

export function updateClientPhoto(clientId, photoId, payload) {
  return clientCareMock.updateClientPhoto(clientId, photoId, payload);
}

export function deleteClientPhoto(clientId, photoId) {
  return clientCareMock.deleteClientPhoto(clientId, photoId);
}

export function buildClientTimeline(params) {
  return clientCareMock.buildClientTimeline(params);
}
