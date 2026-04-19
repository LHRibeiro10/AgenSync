import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authService from "../services/authService.js";
import { setUnauthorizedHandler } from "../api/httpClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [authConfigurationError] = useState(authService.getAuthConfigurationError?.() || "");

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const restored = await authService.restoreSession();
      setUser(restored.user || null);
      setSession(restored.session || null);
      setToken(restored.token || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const unsubscribeAuth = authService.onAuthStateChange?.((event, nextSession) => {
      setSession(nextSession || null);
      setToken(nextSession?.access_token || "");
      setUser(nextSession?.user ? {
        id: nextSession.user.id,
        name: nextSession.user.user_metadata?.name || nextSession.user.email || "Usuario",
        email: nextSession.user.email || "",
        businessName: nextSession.user.user_metadata?.businessName || "",
        businessLogo: nextSession.user.user_metadata?.businessLogo || "",
        businessType: nextSession.user.user_metadata?.businessType || "",
        createdAt: nextSession.user.created_at || new Date().toISOString()
      } : null);
      setLoading(false);
    });

    setUnauthorizedHandler(() => {
      setToken("");
      setUser(null);
      setSession(null);
    });

    return () => {
      unsubscribeAuth?.();
      setUnauthorizedHandler(null);
    };
  }, []);

  const login = useCallback(async (payload) => {
    const result = await authService.login(payload);
    setUser(result.user || null);
    setSession(result.session || null);
    setToken(result.token || "");
    return result;
  }, []);

  const register = useCallback(async (payload) => {
    const result = await authService.register(payload);
    setUser(result.user || null);
    setSession(result.session || null);
    setToken(result.token || "");
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
    setToken("");
    setUser(null);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      session,
      loading,
      authConfigurationError,
      isAuthenticated: Boolean(session || user),
      refreshSession,
      login,
      register,
      logout,
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
      refreshSession,
      login,
      register,
      logout,
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
