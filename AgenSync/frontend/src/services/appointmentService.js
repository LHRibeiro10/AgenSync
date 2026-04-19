import {
  createAppointmentApi,
  deleteAppointmentApi,
  listAppointmentsApi,
  updateAppointmentApi
} from "../api/modules/appointmentsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";
import { localCoreMockApi } from "../mocks/localApi/coreMockApi.js";

export function listAppointments(params) {
  return executeDataSource({
    feature: "appointments.list",
    remote: () => listAppointmentsApi(params),
    mock: () => localCoreMockApi.listAppointments(params)
  });
}

export function createAppointment(payload) {
  return executeDataSource({
    feature: "appointments.create",
    remote: () => createAppointmentApi(payload),
    mock: () => localCoreMockApi.createAppointment(payload)
  });
}

export function updateAppointment(appointmentId, payload) {
  return executeDataSource({
    feature: "appointments.update",
    remote: () => updateAppointmentApi(appointmentId, payload),
    mock: () => localCoreMockApi.updateAppointment(appointmentId, payload)
  });
}

export function deleteAppointment(appointmentId) {
  return executeDataSource({
    feature: "appointments.delete",
    remote: () => deleteAppointmentApi(appointmentId),
    mock: () => localCoreMockApi.deleteAppointment(appointmentId)
  });
}
