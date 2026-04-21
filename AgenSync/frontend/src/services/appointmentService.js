import {
  createAppointmentApi,
  deleteAppointmentApi,
  listAppointmentsApi,
  updateAppointmentApi
} from "../api/modules/appointmentsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

export function listAppointments(params) {
  return executeDataSource({
    feature: "appointments.list",
    remote: () => listAppointmentsApi(params)
  });
}

export function createAppointment(payload) {
  return executeDataSource({
    feature: "appointments.create",
    remote: () => createAppointmentApi(payload)
  });
}

export function updateAppointment(appointmentId, payload) {
  return executeDataSource({
    feature: "appointments.update",
    remote: () => updateAppointmentApi(appointmentId, payload)
  });
}

export function deleteAppointment(appointmentId) {
  return executeDataSource({
    feature: "appointments.delete",
    remote: () => deleteAppointmentApi(appointmentId)
  });
}
