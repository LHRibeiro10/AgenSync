import {
  createExpenseApi,
  deleteExpenseApi,
  listExpensesApi,
  updateExpenseApi
} from "../api/modules/expensesApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";
import * as expensesMock from "../mocks/legacy/expensesMock.js";

function asList(value, key) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function asItem(value, key) {
  if (value?.[key]) return value[key];
  return value;
}

export const expenseCategories = expensesMock.expenseCategories;
export const expenseCategoryLabel = expensesMock.expenseCategoryLabel;

export async function listExpenses(filters = {}) {
  const response = await executeDataSource({
    feature: "expenses.list",
    remote: () => listExpensesApi(filters),
    mock: () => expensesMock.listExpenses(filters)
  });
  return asList(response, "expenses");
}

export async function createExpense(payload) {
  const response = await executeDataSource({
    feature: "expenses.create",
    remote: () => createExpenseApi(payload),
    mock: () => expensesMock.createExpense(payload)
  });
  return asItem(response, "expense");
}

export async function updateExpense(expenseId, payload) {
  const response = await executeDataSource({
    feature: "expenses.update",
    remote: () => updateExpenseApi(expenseId, payload),
    mock: () => expensesMock.updateExpense(expenseId, payload)
  });
  return asItem(response, "expense");
}

export async function deleteExpense(expenseId) {
  return executeDataSource({
    feature: "expenses.delete",
    remote: () => deleteExpenseApi(expenseId),
    mock: () => expensesMock.deleteExpense(expenseId)
  });
}

export function sumExpenses(expenses) {
  return expensesMock.sumExpenses(expenses);
}
