import { env } from "../config/env.js";
import { httpClient } from "../api/httpClient.js";
import * as legacy from "../mocks/legacy/clientCareMock.js";

const CLIENT_CARE_KEY = "agensync_client_care_v1";

function readCareDb() {
  try {
    const data = JSON.parse(localStorage.getItem(CLIENT_CARE_KEY) || "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeCareDb(data) {
  localStorage.setItem(CLIENT_CARE_KEY, JSON.stringify(data));
}

function cacheClientCare(clientId, care) {
  if (!clientId) return;
  const db = readCareDb();
  db[clientId] = care;
  writeCareDb(db);
}

function canUseRemote() {
  return env.dataMode === "remote";
}

async function saveRemote(clientId, care) {
  if (!clientId || !canUseRemote()) return care;
  const result = await httpClient.put(`/clients/${clientId}/care-record`, { body: care });
  cacheClientCare(clientId, result.care);
  return result.care;
}

function persistAfterLocalChange(clientId, care) {
  saveRemote(clientId, care).catch((error) => {
    console.warn("[AgenSync] Falha ao sincronizar prontuario com backend.", error);
  });
  return care;
}

export const emptyAnamnesis = legacy.emptyAnamnesis;

export function getClientCare(clientId) {
  return legacy.getClientCare(clientId);
}

export async function loadClientCare(clientId) {
  if (!clientId) return legacy.getClientCare("");
  if (!canUseRemote()) return legacy.getClientCare(clientId);

  const result = await httpClient.get(`/clients/${clientId}/care-record`);
  cacheClientCare(clientId, result.care);
  return legacy.getClientCare(clientId);
}

export function saveClientAnamnesis(clientId, payload) {
  return persistAfterLocalChange(clientId, legacy.saveClientAnamnesis(clientId, payload));
}

export function createClientDocument(clientId, payload) {
  return persistAfterLocalChange(clientId, legacy.createClientDocument(clientId, payload));
}

export function updateClientDocument(clientId, documentId, payload) {
  return persistAfterLocalChange(clientId, legacy.updateClientDocument(clientId, documentId, payload));
}

export function deleteClientDocument(clientId, documentId) {
  return persistAfterLocalChange(clientId, legacy.deleteClientDocument(clientId, documentId));
}

export function signClientDocument(clientId, documentId, signatureImage) {
  return persistAfterLocalChange(clientId, legacy.signClientDocument(clientId, documentId, signatureImage));
}

export function createClientBudget(clientId, payload) {
  return persistAfterLocalChange(clientId, legacy.createClientBudget(clientId, payload));
}

export function signClientBudget(clientId, budgetId, signatureImage) {
  return persistAfterLocalChange(clientId, legacy.signClientBudget(clientId, budgetId, signatureImage));
}

export const listFormTemplates = legacy.listFormTemplates;
export const createFormTemplate = legacy.createFormTemplate;
export const updateFormTemplate = legacy.updateFormTemplate;
export const duplicateFormTemplate = legacy.duplicateFormTemplate;
export const deleteFormTemplate = legacy.deleteFormTemplate;

export function saveClientForm(clientId, payload) {
  return persistAfterLocalChange(clientId, legacy.saveClientForm(clientId, payload));
}

export function duplicateClientForm(clientId, formId) {
  return persistAfterLocalChange(clientId, legacy.duplicateClientForm(clientId, formId));
}

export function deleteClientForm(clientId, formId) {
  return persistAfterLocalChange(clientId, legacy.deleteClientForm(clientId, formId));
}

export function createClientEvolution(clientId, payload) {
  return persistAfterLocalChange(clientId, legacy.createClientEvolution(clientId, payload));
}

export function updateClientEvolution(clientId, evolutionId, payload) {
  return persistAfterLocalChange(clientId, legacy.updateClientEvolution(clientId, evolutionId, payload));
}

export function deleteClientEvolution(clientId, evolutionId) {
  return persistAfterLocalChange(clientId, legacy.deleteClientEvolution(clientId, evolutionId));
}

export function addClientPhotos(clientId, photos) {
  return persistAfterLocalChange(clientId, legacy.addClientPhotos(clientId, photos));
}

export function updateClientPhoto(clientId, photoId, payload) {
  return persistAfterLocalChange(clientId, legacy.updateClientPhoto(clientId, photoId, payload));
}

export function deleteClientPhoto(clientId, photoId) {
  return persistAfterLocalChange(clientId, legacy.deleteClientPhoto(clientId, photoId));
}

export const buildClientTimeline = legacy.buildClientTimeline;
