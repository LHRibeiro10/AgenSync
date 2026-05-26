import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function listWorkspaceMembersApi() {
  return httpClient.get(endpoints.workspace.members);
}

export function listWorkspaceAuditLogsApi(params) {
  return httpClient.get(endpoints.workspace.auditLogs, { params, cacheTtlMs: 10_000 });
}

export function updateWorkspaceMemberApi(memberId, payload) {
  return httpClient.patch(endpoints.workspace.memberById(memberId), { body: payload });
}

export function disableWorkspaceMemberApi(memberId) {
  return httpClient.patch(endpoints.workspace.disableMember(memberId));
}

export function enableWorkspaceMemberApi(memberId) {
  return httpClient.patch(endpoints.workspace.enableMember(memberId));
}

export function deleteWorkspaceMemberApi(memberId) {
  return httpClient.delete(endpoints.workspace.memberById(memberId));
}

export function listWorkspaceInvitesApi() {
  return httpClient.get(endpoints.workspace.invites);
}

export function createWorkspaceInviteApi(payload) {
  return httpClient.post(endpoints.workspace.invites, { body: payload });
}

export function cancelWorkspaceInviteApi(inviteId) {
  return httpClient.patch(endpoints.workspace.cancelInvite(inviteId));
}

export function validateWorkspaceInviteApi(token) {
  return httpClient.get(endpoints.workspace.validateInvite(token), { omitAuth: true });
}

export function acceptWorkspaceInviteApi(payload) {
  return httpClient.post(endpoints.workspace.acceptInvite, { body: payload });
}
