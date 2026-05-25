export const workspaceRoles = {
  OWNER: "owner",
  ADMIN: "admin",
  PROFESSIONAL: "professional"
};

export const platformRoles = {
  USER: "user",
  SUPPORT: "support",
  DEVELOPER: "developer",
  PLATFORM_OWNER: "platform_owner"
};

const defaultWorkspacePermissions = {
  dashboard: true,
  agenda: true,
  clients: true,
  services: true,
  professionals: true,
  products: true,
  stock: true,
  sales: true,
  subscriptions: true,
  finance: true,
  expenses: true,
  reports: true,
  settings: true,
  admin: true,
  exports: true
};

const professionalPermissions = {
  ...defaultWorkspacePermissions,
  clients: false,
  services: false,
  professionals: false,
  products: false,
  stock: false,
  sales: false,
  subscriptions: false,
  finance: true,
  expenses: false,
  reports: false,
  settings: false,
  admin: false,
  exports: false
};

function normalizeRole(value, fallback = "") {
  return String(value || fallback).trim().toLowerCase();
}

export function getWorkspaceRole(user) {
  const explicitRole = normalizeRole(user?.workspaceRole);
  if (explicitRole) return explicitRole;

  const legacyRole = normalizeRole(user?.role, "user");
  if (legacyRole === "admin") return workspaceRoles.OWNER;
  if (legacyRole === "professional") return workspaceRoles.PROFESSIONAL;
  return workspaceRoles.OWNER;
}

export function getPlatformRole(user) {
  return normalizeRole(user?.platformRole || user?.platform_role);
}

export function isPlatformUser(user) {
  return Object.values(platformRoles).includes(getPlatformRole(user));
}

export function isPlatformOwner(user) {
  const role = getPlatformRole(user);
  return role === platformRoles.DEVELOPER || role === platformRoles.PLATFORM_OWNER;
}

export function canAccessPermission(user, permission) {
  if (!permission) return true;
  if (isPlatformOwner(user)) return false;

  const role = getWorkspaceRole(user);
  const customPermissions = user?.permissions && typeof user.permissions === "object" ? user.permissions : {};
  const basePermissions = role === workspaceRoles.PROFESSIONAL ? professionalPermissions : defaultWorkspacePermissions;

  return customPermissions[permission] ?? basePermissions[permission] ?? false;
}

export function canAccessAdmin(user) {
  const legacyRole = normalizeRole(user?.role);
  const workspaceRole = getWorkspaceRole(user);
  return legacyRole === "admin" || workspaceRole === workspaceRoles.ADMIN;
}
