import {
  createExpenseApi,
  deleteExpenseApi,
  listExpensesApi,
  updateExpenseApi
} from "../api/modules/expensesApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

export const expenseCategories = [
  { value: "materiais", label: "Materiais" },
  { value: "produtos", label: "Produtos" },
  { value: "aluguel", label: "Aluguel" },
  { value: "transporte", label: "Transporte" },
  { value: "contas", label: "Contas" },
  { value: "marketing", label: "Marketing" },
  { value: "outros", label: "Outros" }
];

function asList(value, key) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function asItem(value, key) {
  if (value?.[key]) return value[key];
  return value;
}

export function expenseCategoryLabel(value) {
  return expenseCategories.find((category) => category.value === value)?.label || value;
}

export async function listExpenses(filters = {}) {
  const response = await executeDataSource({
    feature: "expenses.list",
    remote: () => listExpensesApi(filters)
  });
  return asList(response, "expenses");
}

export async function createExpense(payload) {
  const response = await executeDataSource({
    feature: "expenses.create",
    remote: () => createExpenseApi(payload)
  });
  return asItem(response, "expense");
}

export async function updateExpense(expenseId, payload) {
  const response = await executeDataSource({
    feature: "expenses.update",
    remote: () => updateExpenseApi(expenseId, payload)
  });
  return asItem(response, "expense");
}

export async function deleteExpense(expenseId) {
  return executeDataSource({
    feature: "expenses.delete",
    remote: () => deleteExpenseApi(expenseId)
  });
}

export function sumExpenses(expenses) {
  return expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
}
