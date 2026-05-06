import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function registerNotificationTokenApi(payload) {
  return httpClient.post(endpoints.notificationTokens, { body: payload });
}

export function disableNotificationTokenApi(payload) {
  return httpClient.delete(endpoints.notificationTokens, { body: payload });
}

export function listNotificationsApi(params) {
  return httpClient.get(endpoints.notifications.list, { params, cacheTtlMs: 15_000 });
}

export function markNotificationReadApi(notificationId) {
  return httpClient.patch(endpoints.notifications.read(notificationId));
}

export function markAllNotificationsReadApi() {
  return httpClient.patch(endpoints.notifications.readAll);
}
