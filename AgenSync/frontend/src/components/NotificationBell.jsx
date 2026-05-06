import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  enablePushNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../services/notificationService.js";
import Button from "./Button.jsx";
import Icon from "./Icon.jsx";
import { useToast } from "./Toast.jsx";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );

  async function loadNotifications() {
    setLoading(true);
    try {
      const result = await listNotifications({ limit: 8 });
      setNotifications(result.notifications || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    function handleForegroundNotification(event) {
      const notification = event.detail?.notification || {};
      showToast(notification.title || "Nova notificacao recebida.");
      loadNotifications();
    }

    window.addEventListener("agensync:foreground-notification", handleForegroundNotification);
    return () => window.removeEventListener("agensync:foreground-notification", handleForegroundNotification);
  }, [showToast]);

  async function handleEnablePush() {
    setEnablingPush(true);
    try {
      const result = await enablePushNotifications();
      if (result.enabled) {
        showToast("Notificacoes ativadas neste dispositivo.");
      } else {
        showToast("Nao foi possivel ativar notificacoes neste navegador.", "error");
      }
    } catch {
      showToast("Nao foi possivel ativar notificacoes agora.", "error");
    } finally {
      setEnablingPush(false);
    }
  }

  async function openNotification(notification) {
    if (!notification.readAt) {
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item))
      );
      markNotificationRead(notification.id).catch(() => null);
    }

    setOpen(false);
    if (notification.actionUrl) navigate(notification.actionUrl);
  }

  async function readAll() {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, readAt: notification.readAt || new Date().toISOString() }))
    );
    markAllNotificationsRead().catch(() => null);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white text-ink shadow-sm transition active:scale-95"
        aria-label="Abrir notificacoes"
      >
        <Icon name="bell" className="h-5 w-5" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-[75] w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-panel">
          <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] p-4">
            <div>
              <p className="text-sm font-black text-ink">Notificacoes</p>
              <p className="text-xs font-semibold text-muted">{unreadCount} nao lida(s)</p>
            </div>
            <Button variant="ghost" size="sm" onClick={readAll}>
              Ler todas
            </Button>
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm font-semibold text-muted">Carregando...</p>
            ) : notifications.length ? (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className="block w-full border-b border-[#E2E8F0] p-4 text-left transition hover:bg-[#F8FAFC]"
                >
                  <div className="flex gap-2">
                    {!notification.readAt ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" /> : null}
                    <div className="min-w-0">
                      <p className="text-sm font-black text-ink">{notification.title}</p>
                      {notification.body ? (
                        <p className="mt-1 text-sm font-semibold leading-5 text-muted">{notification.body}</p>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <p className="p-4 text-sm font-semibold text-muted">Nenhuma notificacao por enquanto.</p>
            )}
          </div>

          <div className="border-t border-[#E2E8F0] p-3">
            <Button variant="secondary" size="sm" className="w-full" onClick={handleEnablePush} loading={enablingPush}>
              Ativar lembretes neste dispositivo
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
