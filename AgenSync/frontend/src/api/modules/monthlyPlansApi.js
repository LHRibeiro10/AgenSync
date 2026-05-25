import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function listMonthlyPlansApi(params) {
  return httpClient.get(endpoints.subscriptions.monthlyPlans, { params, cacheTtlMs: 10_000 });
}

export function getMonthlyPlanApi(monthlyPlanId) {
  return httpClient.get(endpoints.subscriptions.monthlyPlanById(monthlyPlanId), { cacheTtlMs: 10_000 });
}

export function previewMonthlyPlanScheduleApi(payload) {
  return httpClient.post(`${endpoints.subscriptions.monthlyPlans}/preview`, { body: payload });
}

export function createMonthlyPlanApi(payload) {
  return httpClient.post(endpoints.subscriptions.monthlyPlans, { body: payload });
}

export function updateMonthlyPlanApi(monthlyPlanId, payload) {
  return httpClient.put(endpoints.subscriptions.monthlyPlanById(monthlyPlanId), { body: payload });
}

export function cancelMonthlyPlanApi(monthlyPlanId) {
  return httpClient.post(`${endpoints.subscriptions.monthlyPlanById(monthlyPlanId)}/cancel`);
}

export function generateMonthlyPlanAppointmentsApi(monthlyPlanId, payload) {
  return httpClient.post(`${endpoints.subscriptions.monthlyPlanById(monthlyPlanId)}/generate`, {
    body: payload
  });
}

export function cancelFutureMonthlyPlanAppointmentsApi(monthlyPlanId, payload) {
  return httpClient.post(`${endpoints.subscriptions.monthlyPlanById(monthlyPlanId)}/cancel-future-appointments`, {
    body: payload
  });
}

export function markMonthlyPlanPaymentApi(monthlyPlanId, payload) {
  return httpClient.post(`${endpoints.subscriptions.monthlyPlanById(monthlyPlanId)}/payments`, {
    body: payload
  });
}
