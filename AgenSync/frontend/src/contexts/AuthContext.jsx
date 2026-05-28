import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as authService from "../services/authService.js";
import { httpClient, setUnauthorizedHandler } from "../api/httpClient.js";
import { clearUserDataCache } from "../lib/userDataCache.js";
import { canAccessAdmin, canAccessPermission, getPlatformRole, getWorkspaceRole, isPlatformOwner } from "../lib/permissions.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [authConfigurationError] = useState(authService.getAuthConfigurationError?.() || "");
  const didRunInitialRestore = useRef(false);

  const refreshSession = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const restored = await authService.restoreSession();
      setUser(restored.user || null);
      setSession(restored.session || null);
      setToken(restored.token || "");
    } finally {
      didRunInitialRestore.current = true;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const unsubscribeAuth = authService.onAuthStateChange?.((event, nextSession) => {
      if (event === "INITIAL_SESSION" && !didRunInitialRestore.current) {
        return;
      }

      if (!nextSession) {
        setSession(null);
        setToken("");
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(nextSession || null);
      setToken(nextSession?.access_token || "");
      refreshSession({ silent: true }).catch(() => {
        setLoading(false);
      });
    });

    setUnauthorizedHandler(() => {
      clearUserDataCache();
      setToken("");
      setUser(null);
      setSession(null);
    });

    return () => {
      unsubscribeAuth?.();
      setUnauthorizedHandler(null);
    };
  }, [refreshSession]);

  const login = useCallback(async (payload) => {
    const result = await authService.login(payload);
    setUser(result.user || null);
    setSession(result.session || null);
    setToken(result.token || "");
    return result;
  }, []);

  const register = useCallback(async (payload) => {
    const result = await authService.register(payload);
    const hasAuthenticatedSession = Boolean(result.token || result.session?.access_token);
    setUser(hasAuthenticatedSession ? result.user || null : null);
    setSession(hasAuthenticatedSession ? result.session || null : null);
    setToken(hasAuthenticatedSession ? result.token || result.session?.access_token || "" : "");
    return result;
  }, []);

  const acceptInvite = useCallback(async (payload) => {
    const result = await authService.acceptInvite(payload);
    setUser(result.user || null);
    setSession(result.session || null);
    setToken(result.token || result.session?.access_token || "");
    return result;
  }, []);

  const updateUserSettings = useCallback(async (payload) => {
    const result = await authService.updateUserSettings(payload);
    setUser(result.user || null);
    return result;
  }, []);

  const forgotPassword = useCallback((payload) => authService.forgotPassword(payload), []);

  const resendConfirmation = useCallback((payload) => authService.resendConfirmation(payload), []);

  const applyPasswordResetSessionFromUrl = useCallback(
    (urlValue) => authService.applyPasswordResetSessionFromUrl(urlValue),
    []
  );

  const getPasswordResetTokenFromUrl = useCallback(
    (urlValue) => authService.getPasswordResetTokenFromUrl(urlValue),
    []
  );

  const resetPassword = useCallback((payload) => authService.updatePassword(payload), []);

  const logout = useCallback(async () => {
    await authService.logout();
    httpClient.clearCache?.();
    clearUserDataCache();
    setToken("");
    setUser(null);
    setSession(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await authService.deleteAccount();
    httpClient.clearCache?.();
    clearUserDataCache();
    setToken("");
    setUser(null);
    setSession(null);
  }, []);

  const workspaceRole = getWorkspaceRole(user);
  const platformRole = getPlatformRole(user);
  const currentWorkspace = user?.currentWorkspace || null;
  const workspaceMember = user?.workspaceMember || null;
  const workspacePermissions =
    workspaceMember?.permissions && typeof workspaceMember.permissions === "object"
      ? workspaceMember.permissions
      : user?.permissions && typeof user.permissions === "object"
        ? user.permissions
        : {};
  const plan = currentWorkspace?.plan || user?.plan || user?.platformPlan || "padrao";
  const exceededResources = Array.isArray(currentWorkspace?.exceededResources)
    ? currentWorkspace.exceededResources
    : Array.isArray(user?.exceededResources)
      ? user.exceededResources
      : [];
  const planLimitExceeded = Boolean(currentWorkspace?.planLimitExceeded || user?.planLimitExceeded || exceededResources.length);
  const professionalId = workspaceMember?.professionalId || user?.professionalId || "";
  const isAdmin = canAccessAdmin(user);
  const hasPlatformAccess = isPlatformOwner(user);
  const canAccess = useCallback((permission) => canAccessPermission(user, permission), [user]);

  const value = useMemo(
    () => ({
      token,
      user,
      session,
      loading,
      authConfigurationError,
      isAuthenticated: Boolean(token),
      isAdmin,
      workspaceRole,
      platformRole,
      currentWorkspace,
      workspaceMember,
      workspacePermissions,
      permissions: workspacePermissions,
      plan,
      planLimitExceeded,
      exceededResources,
      professionalId,
      hasPlatformAccess,
      canAccess,
      refreshSession,
      login,
      register,
      acceptInvite,
      logout,
      deleteAccount,
      updateUserSettings,
      forgotPassword,
      resendConfirmation,
      applyPasswordResetSessionFromUrl,
      getPasswordResetTokenFromUrl,
      resetPassword
    }),
    [
      token,
      user,
      session,
      loading,
      authConfigurationError,
      isAdmin,
      workspaceRole,
      platformRole,
      currentWorkspace,
      workspaceMember,
      workspacePermissions,
      plan,
      planLimitExceeded,
      exceededResources,
      professionalId,
      hasPlatformAccess,
      canAccess,
      refreshSession,
      login,
      register,
      acceptInvite,
      logout,
      deleteAccount,
      updateUserSettings,
      forgotPassword,
      resendConfirmation,
      applyPasswordResetSessionFromUrl,
      getPasswordResetTokenFromUrl,
      resetPassword
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }
  return context;
}
