import {
  clearNotificationsApi,
  deleteNotificationApi,
  disableNotificationTokenApi,
  getNotificationSettingsApi,
  listNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  processDueAppointmentRemindersApi,
  registerNotificationTokenApi,
  subscribePushApi,
  testNotificationApi,
  unsubscribePushApi,
  updateNotificationSettingsApi
} from "../api/modules/notificationsApi.js";
import { canUseNotifications, getFcmToken } from "./firebaseMessagingService.js";

const PUSH_TOKEN_KEY = "agensync_fcm_token_v1";
const PUSH_ENDPOINT_KEY = "agensync_push_endpoint_v1";

export const notificationOffsetOptions = [
  { value: 10, label: "10 minutos antes" },
  { value: 15, label: "15 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 1440, label: "1 dia antes" }
];

export function listNotifications(params) {
  return listNotificationsApi(params);
}

export function clearNotifications() {
  return clearNotificationsApi();
}

export function deleteNotification(notificationId) {
  return deleteNotificationApi(notificationId);
}

export function markNotificationRead(notificationId) {
  return markNotificationReadApi(notificationId);
}

export function markAllNotificationsRead() {
  return markAllNotificationsReadApi();
}

export function processDueAppointmentReminders(payload) {
  return processDueAppointmentRemindersApi(payload);
}

export function getNotificationSettings() {
  return getNotificationSettingsApi();
}

export function updateNotificationSettings(payload) {
  return updateNotificationSettingsApi(payload);
}

export function notificationSupport() {
  const hasWindow = typeof window !== "undefined";
  return {
    notificationApi: hasWindow && "Notification" in window,
    serviceWorker: hasWindow && "serviceWorker" in navigator,
    pushManager: hasWindow && "PushManager" in window,
    permission: hasWindow && "Notification" in window ? Notification.permission : "unsupported"
  };
}

export async function requestNotificationPermission() {
  const support = notificationSupport();
  if (!support.notificationApi) return { granted: false, reason: "unsupported" };
  if (Notification.permission === "granted") return { granted: true };
  if (Notification.permission === "denied") return { granted: false, reason: "permission_denied" };

  const permission = await Notification.requestPermission();
  return {
    granted: permission === "granted",
    reason: permission === "granted" ? "" : "permission_denied"
  };
}

export function showLocalNotification({ title, body = "", actionUrl = "/agenda" }) {
  const support = notificationSupport();
  if (!support.notificationApi || Notification.permission !== "granted") {
    return { shown: false, reason: support.notificationApi ? "permission_denied" : "unsupported" };
  }

  const notification = new Notification(title || "AgenSync", {
    body,
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    data: { actionUrl }
  });

  notification.onclick = () => {
    window.focus();
    if (actionUrl) window.location.assign(actionUrl);
    notification.close();
  };

  return { shown: true };
}

async function tryRegisterBrowserPushSubscription() {
  const support = notificationSupport();
  if (!support.serviceWorker || !support.pushManager) {
    return { subscribed: false, reason: "unsupported" };
  }

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => null);
  if (!registration?.pushManager) {
    return { subscribed: false, reason: "unsupported" };
  }

  const subscription = await registration.pushManager.getSubscription().catch(() => null);
  if (!subscription) {
    return { subscribed: false, reason: "subscription_not_available" };
  }

  await subscribePushApi({
    subscription: subscription.toJSON(),
    userAgent: navigator.userAgent
  });
  localStorage.setItem(PUSH_ENDPOINT_KEY, subscription.endpoint);
  return { subscribed: true };
}

export async function enablePushNotifications() {
  if (!canUseNotifications()) {
    return { enabled: false, reason: "unsupported" };
  }

  const result = await getFcmToken();
  if (!result.token) {
    return { enabled: false, reason: result.reason || "missing_token" };
  }

  await registerNotificationTokenApi({
    token: result.token,
    platform: "web",
    userAgent: navigator.userAgent
  });
  localStorage.setItem(PUSH_TOKEN_KEY, result.token);
  const browserPush = await tryRegisterBrowserPushSubscription().catch((error) => ({
    subscribed: false,
    reason: error?.message || "subscription_failed"
  }));

  result.onForegroundMessage?.((payload) => {
    window.dispatchEvent(new CustomEvent("agensync:foreground-notification", { detail: payload }));
  });

  return { enabled: true, browserPush };
}

export async function disablePushNotifications() {
  const token = localStorage.getItem(PUSH_TOKEN_KEY);
  const endpoint = localStorage.getItem(PUSH_ENDPOINT_KEY);
  if (token) {
    await disableNotificationTokenApi({ token });
    localStorage.removeItem(PUSH_TOKEN_KEY);
  }
  if (endpoint) {
    await unsubscribePushApi({ endpoint }).catch(() => null);
    localStorage.removeItem(PUSH_ENDPOINT_KEY);
  }
  return { disabled: true };
}

export async function testNotification() {
  const permission = await requestNotificationPermission();
  if (!permission.granted) return { ok: false, reason: permission.reason };

  const data = await testNotificationApi();
  const notification = data.notification || {};
  showLocalNotification({
    title: notification.title || "Notificacao de teste do AgenSync",
    body: notification.body || notification.message || "Notificacao de teste enviada.",
    actionUrl: notification.actionUrl || "/agenda"
  });

  return { ok: true, notification };
}
