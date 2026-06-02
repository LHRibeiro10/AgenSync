import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function listWorkspaceMembersApi() {
  return httpClient.get(endpoints.workspace.members, { cacheTtlMs: 30000 });
}

export function workspaceTeamOverviewApi(params) {
  return httpClient.get(endpoints.workspace.teamOverview, { params, cacheTtlMs: 30000 });
}

export function listWorkspaceAuditLogsApi(params) {
  return httpClient.get(endpoints.workspace.auditLogs, { params, cacheTtlMs: 30000 });
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
  return httpClient.get(endpoints.workspace.invites, { cacheTtlMs: 30000 });
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
