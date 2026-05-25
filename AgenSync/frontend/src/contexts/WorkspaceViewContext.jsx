import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { getWorkspaceRole, workspaceRoles } from "../lib/permissions.js";

const WorkspaceViewContext = createContext(null);
const STORAGE_PREFIX = "agensync_workspace_view";

function storageKey(userId) {
  return `${STORAGE_PREFIX}_${userId || "guest"}`;
}

function readStoredView(userId) {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function WorkspaceViewProvider({ children }) {
  const { user } = useAuth();
  const [selectedProfessionalId, setSelectedProfessionalIdState] = useState("");
  const [period, setPeriodState] = useState("today");

  const role = getWorkspaceRole(user);
  const isProfessional = role === workspaceRoles.PROFESSIONAL;
  const canManageWorkspace = role === workspaceRoles.OWNER || role === workspaceRoles.ADMIN;

  useEffect(() => {
    const stored = readStoredView(user?.id);
    setSelectedProfessionalIdState(stored.selectedProfessionalId || "");
    setPeriodState(stored.period || "today");
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;

    window.localStorage.setItem(
      storageKey(user.id),
      JSON.stringify({
        selectedProfessionalId,
        period
      })
    );
  }, [period, selectedProfessionalId, user?.id]);

  const setSelectedProfessionalId = useCallback(
    (professionalId) => {
      if (!canManageWorkspace) return;
      setSelectedProfessionalIdState(professionalId || "");
    },
    [canManageWorkspace]
  );

  const setPeriod = useCallback((nextPeriod) => {
    setPeriodState(nextPeriod || "today");
  }, []);

  const value = useMemo(
    () => ({
      selectedProfessionalId: isProfessional ? user?.professionalId || selectedProfessionalId : selectedProfessionalId,
      setSelectedProfessionalId,
      period,
      setPeriod,
      role,
      isProfessional,
      canManageWorkspace,
      viewMode: selectedProfessionalId || isProfessional ? "professional" : "all"
    }),
    [
      canManageWorkspace,
      isProfessional,
      period,
      role,
      selectedProfessionalId,
      setPeriod,
      setSelectedProfessionalId,
      user?.professionalId
    ]
  );

  return <WorkspaceViewContext.Provider value={value}>{children}</WorkspaceViewContext.Provider>;
}

export function useWorkspaceView() {
  const context = useContext(WorkspaceViewContext);
  if (!context) {
    throw new Error("useWorkspaceView deve ser usado dentro de WorkspaceViewProvider.");
  }
  return context;
}
