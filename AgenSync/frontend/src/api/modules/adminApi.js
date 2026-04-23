import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function adminSummaryApi() {
  return httpClient.get(endpoints.admin.summary, { cacheTtlMs: 15_000 });
}

export function adminUsersApi(params) {
  return httpClient.get(endpoints.admin.users, { params, cacheTtlMs: 15_000 });
}

export function updateAdminUserRoleApi(userId, role) {
  return httpClient.patch(endpoints.admin.userRole(userId), {
    body: { role }
  });
}

export function adminAuditLogsApi(params) {
  return httpClient.get(endpoints.admin.auditLogs, { params, cacheTtlMs: 10_000 });
}
