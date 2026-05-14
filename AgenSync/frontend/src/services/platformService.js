import {
  platformOverviewApi,
  platformWorkspaceApi,
  platformWorkspacesApi,
  updatePlatformUserStatusApi,
  updatePlatformWorkspacePlanApi,
  updatePlatformWorkspaceStatusApi
} from "../api/modules/platformApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

export async function getPlatformOverview(params = {}) {
  return executeDataSource({
    feature: "platform.overview",
    remote: () => platformOverviewApi(params)
  });
}

export async function listPlatformWorkspaces(params = {}) {
  const response = await executeDataSource({
    feature: "platform.workspaces",
    remote: () => platformWorkspacesApi(params)
  });
  return response?.workspaces || [];
}

export async function getPlatformWorkspace(id, params = {}) {
  return executeDataSource({
    feature: "platform.workspaces.detail",
    remote: () => platformWorkspaceApi(id, params)
  });
}

export async function updatePlatformWorkspaceStatus(id, payload) {
  const response = await executeDataSource({
    feature: "platform.workspaces.status",
    remote: () => updatePlatformWorkspaceStatusApi(id, payload)
  });
  return response?.workspace || response;
}

export async function updatePlatformWorkspacePlan(id, payload) {
  const response = await executeDataSource({
    feature: "platform.workspaces.plan",
    remote: () => updatePlatformWorkspacePlanApi(id, payload)
  });
  return response?.workspace || response;
}

export async function updatePlatformUserStatus(id, payload) {
  const response = await executeDataSource({
    feature: "platform.users.status",
    remote: () => updatePlatformUserStatusApi(id, payload)
  });
  return response?.user || response;
}
