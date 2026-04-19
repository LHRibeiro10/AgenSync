import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authService from "../services/authService.js";
import { setUnauthorizedHandler } from "../api/httpClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const restored = await authService.restoreSession();
      setUser(restored.user || null);
      setToken(restored.token || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken("");
      setUser(null);
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (payload) => {
    const result = await authService.login(payload);
    setUser(result.user || null);
    setToken(result.token || "");
    return result;
  }, []);

  const register = useCallback(async (payload) => {
    const result = await authService.register(payload);
    setUser(result.user || null);
    setToken(result.token || "");
    return result;
  }, []);

  const updateUserSettings = useCallback(async (payload) => {
    const result = await authService.updateUserSettings(payload);
    setUser(result.user || null);
    return result;
  }, []);

  const forgotPassword = useCallback((payload) => authService.forgotPassword(payload), []);

  const applyPasswordResetSessionFromUrl = useCallback(
    (urlValue) => authService.applyPasswordResetSessionFromUrl(urlValue),
    []
  );

  const getPasswordResetTokenFromUrl = useCallback(
    (urlValue) => authService.getPasswordResetTokenFromUrl(urlValue),
    []
  );

  const resetPassword = useCallback((payload) => authService.resetPassword(payload), []);

  const logout = useCallback(async () => {
    await authService.logout();
    setToken("");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(user),
      refreshSession,
      login,
      register,
      logout,
      updateUserSettings,
      forgotPassword,
      applyPasswordResetSessionFromUrl,
      getPasswordResetTokenFromUrl,
      resetPassword
    }),
    [
      token,
      user,
      loading,
      refreshSession,
      login,
      register,
      logout,
      updateUserSettings,
      forgotPassword,
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
