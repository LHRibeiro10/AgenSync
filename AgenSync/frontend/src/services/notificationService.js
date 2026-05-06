import {
  disableNotificationTokenApi,
  listNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  registerNotificationTokenApi
} from "../api/modules/notificationsApi.js";
import { canUseNotifications, getFcmToken } from "./firebaseMessagingService.js";

const PUSH_TOKEN_KEY = "agensync_fcm_token_v1";

export function listNotifications(params) {
  return listNotificationsApi(params);
}

export function markNotificationRead(notificationId) {
  return markNotificationReadApi(notificationId);
}

export function markAllNotificationsRead() {
  return markAllNotificationsReadApi();
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

  result.onForegroundMessage?.((payload) => {
    window.dispatchEvent(new CustomEvent("agensync:foreground-notification", { detail: payload }));
  });

  return { enabled: true };
}

export async function disablePushNotifications() {
  const token = localStorage.getItem(PUSH_TOKEN_KEY);
  if (!token) return { disabled: true };
  await disableNotificationTokenApi({ token });
  localStorage.removeItem(PUSH_TOKEN_KEY);
  return { disabled: true };
}
