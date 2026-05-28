import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function listAppointmentsApi(params) {
  return httpClient.get(endpoints.appointments.list, { params, cacheTtlMs: 30000 });
}

export function getAppointmentApi(appointmentId) {
  return httpClient.get(endpoints.appointments.byId(appointmentId), { cacheTtlMs: 30000 });
}

export function createAppointmentApi(payload) {
  return httpClient.post(endpoints.appointments.list, { body: payload });
}

export function updateAppointmentApi(appointmentId, payload) {
  return httpClient.put(endpoints.appointments.byId(appointmentId), { body: payload });
}

export function deleteAppointmentApi(appointmentId) {
  return httpClient.delete(endpoints.appointments.byId(appointmentId));
}
