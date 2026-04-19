import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function listMonthlyPlansApi(params) {
  return httpClient.get(endpoints.subscriptions.monthlyPlans, { params });
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

export function markMonthlyPlanPaymentApi(monthlyPlanId, payload) {
  return httpClient.post(`${endpoints.subscriptions.monthlyPlanById(monthlyPlanId)}/payments`, {
    body: payload
  });
}
