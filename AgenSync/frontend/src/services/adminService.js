import {
  adminAuditLogsApi,
  adminSummaryApi,
  adminUsersApi,
  updateAdminUserRoleApi
} from "../api/modules/adminApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

function asList(value, key) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  return [];
}

export async function getAdminSummary() {
  const response = await executeDataSource({
    feature: "admin.summary",
    remote: () => adminSummaryApi()
  });
  return response?.summary || {};
}

export async function listAdminUsers(params = {}) {
  const response = await executeDataSource({
    feature: "admin.users",
    remote: () => adminUsersApi(params)
  });
  return asList(response, "users");
}

export async function updateAdminUserRole(userId, role) {
  const response = await executeDataSource({
    feature: "admin.users.role",
    remote: () => updateAdminUserRoleApi(userId, role)
  });
  return response?.user || response;
}

export async function listAdminAuditLogs(params = {}) {
  const response = await executeDataSource({
    feature: "admin.auditLogs",
    remote: () => adminAuditLogsApi(params)
  });
  return asList(response, "logs");
}
