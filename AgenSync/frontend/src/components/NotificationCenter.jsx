import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { addDays, formatDateKey } from "./agenda/agendaDate.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import Button from "./Button.jsx";
import EmptyState from "./EmptyState.jsx";
import Icon from "./Icon.jsx";
import { useToast } from "./Toast.jsx";
import {
  clearNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  processDueAppointmentReminders,
  showLocalNotification
} from "../services/notificationService.js";
import { todayInputValue } from "../utils.js";

function dateTimeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function upcomingLabel(appointment) {
  return `${appointment.client?.name || "Cliente"} - ${appointment.service?.name || "Serviço"} às ${appointment.startTime}`;
}

const shownBrowserNotificationIds = new Set();
let hasPrimedNotificationList = false;
const NOTIFICATION_CACHE_TTL_MS = 30000;
const PROCESS_DUE_COOLDOWN_MS = 5 * 60 * 1000;
const notificationStateByWorkspace = new Map();
const notificationListeners = new Set();
const lastProcessDueByWorkspace = new Map();

function createNotificationState() {
  return {
    notifications: [],
    upcoming: [],
    unreadCount: 0,
    error: "",
    loadedAt: 0,
    upcomingLoadedAt: 0,
    inflight: null,
    inflightIncludesUpcoming: false
  };
}

function getNotificationState(workspaceId) {
  if (!notificationStateByWorkspace.has(workspaceId)) {
    notificationStateByWorkspace.set(workspaceId, createNotificationState());
  }

  return notificationStateByWorkspace.get(workspaceId);
}

function snapshotNotificationState(state) {
  return {
    notifications: state.notifications || [],
    upcoming: state.upcoming || [],
    unreadCount: state.unreadCount || 0,
    error: state.error || "",
    loadedAt: state.loadedAt || 0
  };
}

function publishNotificationState(workspaceId) {
  const snapshot = snapshotNotificationState(getNotificationState(workspaceId));
  notificationListeners.forEach((listener) => listener(workspaceId, snapshot));
}

function subscribeNotificationState(workspaceId, callback) {
  const listener = (nextWorkspaceId, snapshot) => {
    if (nextWorkspaceId === workspaceId) callback(snapshot);
  };

  notificationListeners.add(listener);
  callback(snapshotNotificationState(getNotificationState(workspaceId)));

  return () => notificationListeners.delete(listener);
}

function updateNotificationState(workspaceId, patch) {
  const state = getNotificationState(workspaceId);
  Object.assign(state, patch);
  publishNotificationState(workspaceId);
  return snapshotNotificationState(state);
}

function mutateNotificationState(workspaceId, updater) {
  const current = snapshotNotificationState(getNotificationState(workspaceId));
  const next = updater(current) || current;
  return updateNotificationState(workspaceId, {
    notifications: next.notifications || [],
    upcoming: next.upcoming || [],
    unreadCount: next.unreadCount || 0,
    error: next.error || "",
    loadedAt: Date.now()
  });
}

function processDueStorageKey(workspaceId) {
  return `agensync_process_due_${workspaceId}`;
}

function readLastProcessDueAt(workspaceId) {
  const memoryValue = lastProcessDueByWorkspace.get(workspaceId);
  if (memoryValue) return memoryValue;

  if (typeof window === "undefined") return 0;

  try {
    const stored = Number(window.sessionStorage.getItem(processDueStorageKey(workspaceId)) || 0);
    if (Number.isFinite(stored) && stored > 0) {
      lastProcessDueByWorkspace.set(workspaceId, stored);
      return stored;
    }
  } catch {
    return 0;
  }

  return 0;
}

function writeLastProcessDueAt(workspaceId, value) {
  lastProcessDueByWorkspace.set(workspaceId, value);

  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(processDueStorageKey(workspaceId), String(value));
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

async function processDueOncePerWorkspace(workspaceId) {
  const lastRunAt = readLastProcessDueAt(workspaceId);
  if (Date.now() - lastRunAt < PROCESS_DUE_COOLDOWN_MS) return null;

  writeLastProcessDueAt(workspaceId, Date.now());
  return processDueAppointmentReminders({ limit: 50 }).catch(() => null);
}

async function loadNotificationSnapshot(workspaceId, { force = false, includeUpcoming = false } = {}) {
  const state = getNotificationState(workspaceId);
  const notificationsFresh = state.loadedAt && Date.now() - state.loadedAt < NOTIFICATION_CACHE_TTL_MS;
  const upcomingFresh =
    !includeUpcoming || (state.upcomingLoadedAt && Date.now() - state.upcomingLoadedAt < NOTIFICATION_CACHE_TTL_MS);

  if (!force && notificationsFresh && upcomingFresh) {
    return snapshotNotificationState(state);
  }

  if (state.inflight) {
    if (!includeUpcoming || state.inflightIncludesUpcoming) return state.inflight;
    await state.inflight.catch(() => null);
    return loadNotificationSnapshot(workspaceId, { force, includeUpcoming });
  }

  state.inflightIncludesUpcoming = includeUpcoming;
  state.inflight = (async () => {
    const reminderResult = await processDueOncePerWorkspace(workspaceId);
    const today = todayInputValue();
    const endDate = formatDateKey(addDays(new Date(), 7));
    const requests = [listNotifications({ limit: 30 })];
    if (includeUpcoming) {
      requests.push(api.listAppointments({ startDate: today, endDate }));
    }
    const [notificationResult, appointmentsResult] = await Promise.allSettled(requests);

    if (notificationResult.status === "rejected") throw notificationResult.reason;

    const notificationData = notificationResult.value;
    const appointmentsData =
      includeUpcoming && appointmentsResult?.status === "fulfilled" ? appointmentsResult.value : { appointments: [] };
    const nextNotifications = notificationData.notifications || [];
    const futureAppointments = includeUpcoming
      ? (appointmentsData.appointments || [])
          .filter((appointment) => ["agendado", "confirmado", "pendente"].includes(appointment.status))
          .slice(0, 5)
      : state.upcoming || [];

    const snapshot = updateNotificationState(workspaceId, {
      notifications: nextNotifications,
      unreadCount: notificationData.unreadCount || 0,
      upcoming: futureAppointments,
      error: "",
      loadedAt: Date.now(),
      upcomingLoadedAt: includeUpcoming ? Date.now() : state.upcomingLoadedAt
    });

    return {
      ...snapshot,
      reminderNotifications: reminderResult?.notifications || []
    };
  })()
    .catch((err) => {
      updateNotificationState(workspaceId, {
        error: err.message || "Nao foi possivel carregar notificacoes.",
        loadedAt: Date.now()
      });
      throw err;
    })
    .finally(() => {
      getNotificationState(workspaceId).inflight = null;
      getNotificationState(workspaceId).inflightIncludesUpcoming = false;
    });

  return state.inflight;
}

function shouldShowBrowserNotification(notification) {
  return (
    notification?.id &&
    !shownBrowserNotificationIds.has(notification.id) &&
    !notification.readAt &&
    ["appointment_reminder", "test"].includes(notification.type)
  );
}

function showBrowserNotifications(notifications = []) {
  notifications.filter(shouldShowBrowserNotification).forEach((notification) => {
    shownBrowserNotificationIds.add(notification.id);
    showLocalNotification({
      title: notification.title,
      body: notification.message || notification.body,
      actionUrl: notification.actionUrl || "/agenda"
    });
  });
}

function primeNotificationList(notifications = []) {
  notifications.forEach((notification) => {
    if (notification?.id) shownBrowserNotificationIds.add(notification.id);
  });
  hasPrimedNotificationList = true;
}

export default function NotificationCenter({ tone = "light" }) {
  const navigate = useNavigate();
  const { user, currentWorkspace, hasPlatformAccess, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const workspaceId = currentWorkspace?.id || "";
  const notificationScopeId = user?.id && workspaceId ? `${user.id}:${workspaceId}` : "";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");

  const hasItems = notifications.length || upcoming.length;
  const canUsePortal = typeof document !== "undefined";
  const canLoadWorkspaceNotifications = isAuthenticated && !hasPlatformAccess && Boolean(notificationScopeId);
  const buttonClass = useMemo(() => {
    const base = "relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition active:scale-95";
    if (tone === "dark") {
      return `${base} border-white/10 bg-white/[0.07] text-white hover:bg-white/[0.12]`;
    }
    return `${base} border-line bg-panel text-ink shadow-sm hover:bg-brand/10 hover:text-brand`;
  }, [tone]);

  function applySnapshot(snapshot) {
    setNotifications(snapshot.notifications || []);
    setUnreadCount(snapshot.unreadCount || 0);
    setUpcoming(snapshot.upcoming || []);
    setError(snapshot.error || "");
  }

  async function loadData({ silent = false, force = false, includeUpcoming = false } = {}) {
    if (!notificationScopeId) return;
    if (!silent) setLoading(true);
    setError("");

    try {
      const snapshot = await loadNotificationSnapshot(notificationScopeId, { force, includeUpcoming });
      const nextNotifications = snapshot.notifications || [];
      showBrowserNotifications(snapshot.reminderNotifications || []);

      if (hasPrimedNotificationList) {
        showBrowserNotifications(nextNotifications);
      } else {
        primeNotificationList(nextNotifications);
      }

      applySnapshot(snapshot);
    } catch (err) {
      setError(err.message || "Nao foi possivel carregar notificacoes.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!canLoadWorkspaceNotifications) return undefined;
    const unsubscribe = subscribeNotificationState(notificationScopeId, applySnapshot);
    loadData({ silent: true });
    const timer = window.setInterval(() => loadData({ silent: true }), 60000);
    const onForegroundNotification = () => loadData({ silent: true });
    window.addEventListener("agensync:foreground-notification", onForegroundNotification);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("agensync:foreground-notification", onForegroundNotification);
    };
  }, [canLoadWorkspaceNotifications, notificationScopeId]);

  useEffect(() => {
    if (open && canLoadWorkspaceNotifications) loadData({ force: true, includeUpcoming: true });
  }, [canLoadWorkspaceNotifications, open, notificationScopeId]);

  if (!canLoadWorkspaceNotifications) return null;

  async function openNotification(notification) {
    if (!notification.readAt) {
      const data = await markNotificationRead(notification.id).catch(() => null);
      if (data?.notification) {
        mutateNotificationState(notificationScopeId, (current) => ({
          ...current,
          notifications: current.notifications.map((item) =>
            item.id === notification.id ? data.notification : item
          ),
          unreadCount: Math.max(0, current.unreadCount - 1)
        }));
      }
    }

    setOpen(false);
    if (notification.actionUrl) navigate(notification.actionUrl);
  }

  function openAppointment(appointment) {
    setOpen(false);
    navigate(`/agenda?agendamento=${appointment.id}`);
  }

  async function readAll() {
    await markAllNotificationsRead();
    mutateNotificationState(notificationScopeId, (current) => ({
      ...current,
      notifications: current.notifications.map((item) => ({
        ...item,
        readAt: item.readAt || new Date().toISOString(),
        read: true
      })),
      unreadCount: 0
    }));
  }

  async function clearAll() {
    if (!notifications.length || clearing) return;
    setClearing(true);
    try {
      await clearNotifications();
      mutateNotificationState(notificationScopeId, (current) => ({
        ...current,
        notifications: [],
        unreadCount: 0
      }));
      showToast("Notificações limpas.");
    } catch (err) {
      showToast(err.message || "Não foi possível limpar as notificações.", "error");
    } finally {
      setClearing(false);
    }
  }

  const panel = open ? (
    <div className="agensync-overlay z-[90] flex items-end bg-slate-950/35 p-3 backdrop-blur-sm sm:items-start sm:justify-end sm:p-5">
      <button type="button" className="absolute inset-0" onClick={() => setOpen(false)} aria-label="Fechar notificações" />
      <section className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-line bg-white shadow-panel sm:mt-12 sm:max-w-md sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">Central</p>
            <h2 className="mt-1 text-xl font-black text-ink">Notificações</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-lg font-black text-slate-500"
            aria-label="Fechar"
          >
            X
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-danger">{error}</div>
          ) : null}

          {loading ? (
            <div className="flex min-h-44 items-center justify-center text-sm font-black text-muted">Carregando notificações...</div>
          ) : !hasItems ? (
            <EmptyState
              title="Nenhuma notificação por enquanto."
              description="Lembretes e avisos importantes aparecem aqui quando houver algo novo."
            />
          ) : (
            <div className="space-y-4">
              {upcoming.length ? (
                <section>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Próximos agendamentos</p>
                  <div className="mt-2 space-y-2">
                    {upcoming.map((appointment) => (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => openAppointment(appointment)}
                        className="w-full rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-left transition hover:border-brand/40"
                      >
                        <p className="text-sm font-black text-ink">{upcomingLabel(appointment)}</p>
                        <p className="mt-1 text-xs font-bold text-muted">{appointment.date}</p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {notifications.length ? (
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Lembretes e avisos</p>
                    <div className="flex shrink-0 items-center gap-3">
                      {unreadCount ? (
                        <button type="button" onClick={readAll} className="text-xs font-black text-brand hover:text-brand-dark">
                          Marcar lidas
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={clearAll}
                        disabled={clearing}
                        className="text-xs font-black text-slate-500 transition hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {clearing ? "Limpando..." : "Limpar"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-2">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => openNotification(notification)}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition hover:border-brand/40 ${
                          notification.readAt ? "border-line bg-white" : "border-blue-100 bg-blue-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-black text-ink">{notification.title}</p>
                          {!notification.readAt ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" /> : null}
                        </div>
                        <p className="mt-1 text-sm leading-5 text-muted">{notification.message || notification.body}</p>
                        <p className="mt-2 text-xs font-bold text-slate-500">{dateTimeLabel(notification.createdAt)}</p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>

        <footer className="border-t border-line p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <Button variant="secondary" className="w-full" onClick={() => loadData({ force: true, includeUpcoming: true })}>
            Atualizar
          </Button>
        </footer>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass} aria-label="Abrir notificações">
        <Icon name="bell" className="h-5 w-5" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {canUsePortal && panel ? createPortal(panel, document.body) : panel}
    </>
  );
}
