import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function registerNotificationTokenApi(payload) {
  return httpClient.post(endpoints.notificationTokens, { body: payload });
}

export function disableNotificationTokenApi(payload) {
  return httpClient.delete(endpoints.notificationTokens, { body: payload });
}

export function listNotificationsApi(params) {
  return httpClient.get(endpoints.notifications.list, { params, cacheTtlMs: 30000 });
}

export function clearNotificationsApi() {
  return httpClient.delete(endpoints.notifications.clear);
}

export function deleteNotificationApi(notificationId) {
  return httpClient.delete(endpoints.notifications.delete(notificationId));
}

export function markNotificationReadApi(notificationId) {
  return httpClient.patch(endpoints.notifications.read(notificationId));
}

export function markAllNotificationsReadApi() {
  return httpClient.patch(endpoints.notifications.readAll);
}

export function getNotificationSettingsApi() {
  return httpClient.get(endpoints.notifications.settings, { cacheTtlMs: 30000 });
}

export function updateNotificationSettingsApi(payload) {
  return httpClient.put(endpoints.notifications.settings, { body: payload });
}

export function testNotificationApi() {
  return httpClient.post(endpoints.notifications.test);
}

export function subscribePushApi(payload) {
  return httpClient.post(endpoints.notifications.pushSubscribe, { body: payload });
}

export function unsubscribePushApi(payload) {
  return httpClient.delete(endpoints.notifications.pushUnsubscribe, { body: payload });
}

export function processDueAppointmentRemindersApi(payload = {}) {
  return httpClient.post(endpoints.appointmentReminders.processDue, { body: payload });
}
