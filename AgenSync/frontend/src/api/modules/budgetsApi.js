import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function listBudgetsApi(params) {
  return httpClient.get(endpoints.budgets.list, { params });
}

export function createBudgetApi(payload) {
  return httpClient.post(endpoints.budgets.list, { body: payload });
}

export function updateBudgetApi(budgetId, payload) {
  return httpClient.put(endpoints.budgets.byId(budgetId), { body: payload });
}

export function deleteBudgetApi(budgetId) {
  return httpClient.delete(endpoints.budgets.byId(budgetId));
}

export function signBudgetApi(budgetId, payload) {
  return httpClient.post(`${endpoints.budgets.byId(budgetId)}/sign`, { body: payload });
}
