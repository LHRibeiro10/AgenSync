import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { addDays, formatDateKey } from "./agenda/agendaDate.js";
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
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");

  const hasItems = notifications.length || upcoming.length;
  const canUsePortal = typeof document !== "undefined";
  const buttonClass = useMemo(() => {
    const base = "relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition active:scale-95";
    if (tone === "dark") {
      return `${base} border-white/10 bg-white/[0.07] text-white hover:bg-white/[0.12]`;
    }
    return `${base} border-line bg-panel text-ink shadow-sm hover:bg-brand/10 hover:text-brand`;
  }, [tone]);

  async function loadData({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setError("");

    try {
      const reminderResult = await processDueAppointmentReminders({ limit: 50 }).catch(() => null);
      showBrowserNotifications(reminderResult?.notifications || []);

      const today = todayInputValue();
      const endDate = formatDateKey(addDays(new Date(), 7));
      const [notificationResult, appointmentsResult] = await Promise.allSettled([
        listNotifications({ limit: 30 }),
        api.listAppointments({ startDate: today, endDate })
      ]);
      if (notificationResult.status === "rejected") throw notificationResult.reason;

      const notificationData = notificationResult.value;
      const appointmentsData = appointmentsResult.status === "fulfilled" ? appointmentsResult.value : { appointments: [] };
      const nextNotifications = notificationData.notifications || [];

      if (hasPrimedNotificationList) {
        showBrowserNotifications(nextNotifications);
      } else {
        primeNotificationList(nextNotifications);
      }

      const futureAppointments = (appointmentsData.appointments || [])
        .filter((appointment) => ["agendado", "confirmado", "pendente"].includes(appointment.status))
        .slice(0, 5);

      setNotifications(nextNotifications);
      setUnreadCount(notificationData.unreadCount || 0);
      setUpcoming(futureAppointments);
    } catch (err) {
      setError(err.message || "Nao foi possivel carregar notificacoes.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadData({ silent: true });
    const timer = window.setInterval(() => loadData({ silent: true }), 60000);
    const onForegroundNotification = () => loadData({ silent: true });
    window.addEventListener("agensync:foreground-notification", onForegroundNotification);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("agensync:foreground-notification", onForegroundNotification);
    };
  }, []);

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  async function openNotification(notification) {
    if (!notification.readAt) {
      const data = await markNotificationRead(notification.id).catch(() => null);
      if (data?.notification) {
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? data.notification : item))
        );
        setUnreadCount((count) => Math.max(0, count - 1));
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
    setNotifications((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString(), read: true }))
    );
    setUnreadCount(0);
  }

  async function clearAll() {
    if (!notifications.length || clearing) return;
    setClearing(true);
    try {
      await clearNotifications();
      setNotifications([]);
      setUnreadCount(0);
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
          <Button variant="secondary" className="w-full" onClick={() => loadData()}>
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
