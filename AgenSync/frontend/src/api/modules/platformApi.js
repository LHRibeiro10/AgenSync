import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function platformOverviewApi(params) {
  return httpClient.get(endpoints.platform.overview, { params, cacheTtlMs: 30000 });
}

export function platformMetricsApi(params) {
  return httpClient.get(endpoints.platform.metrics, { params, cacheTtlMs: 30000 });
}

export function platformWorkspacesApi(params) {
  return httpClient.get(endpoints.platform.workspaces, { params, cacheTtlMs: 30000 });
}

export function platformWorkspaceApi(id, params) {
  return httpClient.get(endpoints.platform.workspaceById(id), { params, cacheTtlMs: 30000 });
}

export function updatePlatformWorkspaceStatusApi(id, payload) {
  return httpClient.patch(endpoints.platform.workspaceStatus(id), { body: payload });
}

export function updatePlatformWorkspacePlanApi(id, payload) {
  return httpClient.patch(endpoints.platform.workspacePlan(id), { body: payload });
}

export function deletePlatformWorkspaceApi(id, payload) {
  return httpClient.delete(endpoints.platform.workspaceDelete(id), { body: payload });
}

export function updatePlatformUserStatusApi(id, payload) {
  return httpClient.patch(endpoints.platform.userStatus(id), { body: payload });
}
