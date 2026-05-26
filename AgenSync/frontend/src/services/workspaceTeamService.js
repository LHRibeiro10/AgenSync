import {
  acceptWorkspaceInviteApi,
  cancelWorkspaceInviteApi,
  createWorkspaceInviteApi,
  deleteWorkspaceMemberApi,
  disableWorkspaceMemberApi,
  enableWorkspaceMemberApi,
  listWorkspaceInvitesApi,
  listWorkspaceMembersApi,
  updateWorkspaceMemberApi,
  validateWorkspaceInviteApi
} from "../api/modules/workspaceApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

export function listWorkspaceMembers() {
  return executeDataSource({
    feature: "workspace.members.list",
    remote: () => listWorkspaceMembersApi()
  });
}

export function updateWorkspaceMember(memberId, payload) {
  return executeDataSource({
    feature: "workspace.members.update",
    remote: () => updateWorkspaceMemberApi(memberId, payload)
  });
}

export function disableWorkspaceMember(memberId) {
  return executeDataSource({
    feature: "workspace.members.disable",
    remote: () => disableWorkspaceMemberApi(memberId)
  });
}

export function enableWorkspaceMember(memberId) {
  return executeDataSource({
    feature: "workspace.members.enable",
    remote: () => enableWorkspaceMemberApi(memberId)
  });
}

export function deleteWorkspaceMember(memberId) {
  return executeDataSource({
    feature: "workspace.members.delete",
    remote: () => deleteWorkspaceMemberApi(memberId)
  });
}

export function listWorkspaceInvites() {
  return executeDataSource({
    feature: "workspace.invites.list",
    remote: () => listWorkspaceInvitesApi()
  });
}

export function createWorkspaceInvite(payload) {
  return executeDataSource({
    feature: "workspace.invites.create",
    remote: () => createWorkspaceInviteApi(payload)
  });
}

export function cancelWorkspaceInvite(inviteId) {
  return executeDataSource({
    feature: "workspace.invites.cancel",
    remote: () => cancelWorkspaceInviteApi(inviteId)
  });
}

export function validateWorkspaceInvite(token) {
  return validateWorkspaceInviteApi(token);
}

export function acceptWorkspaceInvite(payload) {
  return acceptWorkspaceInviteApi(payload);
}
