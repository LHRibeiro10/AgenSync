import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function listExpensesApi(params) {
  return httpClient.get(endpoints.expenses.list, { params, cacheTtlMs: 10_000 });
}

export function createExpenseApi(payload) {
  return httpClient.post(endpoints.expenses.list, { body: payload });
}

export function updateExpenseApi(expenseId, payload) {
  return httpClient.put(endpoints.expenses.byId(expenseId), { body: payload });
}

export function deleteExpenseApi(expenseId) {
  return httpClient.delete(endpoints.expenses.byId(expenseId));
}
