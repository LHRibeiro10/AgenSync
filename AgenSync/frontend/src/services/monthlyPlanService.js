import {
  cancelMonthlyPlanApi,
  cancelFutureMonthlyPlanAppointmentsApi,
  createMonthlyPlanApi,
  generateMonthlyPlanAppointmentsApi,
  getMonthlyPlanApi,
  listMonthlyPlansApi,
  markMonthlyPlanPaymentApi,
  previewMonthlyPlanScheduleApi,
  updateMonthlyPlanApi
} from "../api/modules/monthlyPlansApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

function asList(value, key) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function asItem(value, key) {
  if (value?.[key]) return value[key];
  return value;
}

export function subscriptionStatusLabel(status) {
  if (status === "paid") return "Pago";
  if (status === "overdue") return "Atrasado";
  if (status === "canceled") return "Cancelada";
  if (status === "paused") return "Pausada";
  return "Pendente";
}

export function sumPaidSubscriptionCycles(cycles) {
  return cycles
    .filter((cycle) => cycle.status === "paid")
    .reduce((total, cycle) => total + Number(cycle.amount || 0), 0);
}

export function sumExpectedSubscriptionCycles(cycles) {
  return cycles.reduce((total, cycle) => total + Number(cycle.amount || 0), 0);
}

export async function listSubscriptions(filters = {}) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.list",
    remote: () => listMonthlyPlansApi(filters)
  });
  return asList(response, "monthlyPlans");
}

export async function getSubscription(subscriptionId) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.get",
    remote: () => getMonthlyPlanApi(subscriptionId)
  });
  return asItem(response, "monthlyPlan");
}

export async function listSubscriptionCycles(filters = {}) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.cycles",
    remote: () => listMonthlyPlansApi({ ...filters, includeCycles: true })
  });

  if (Array.isArray(response?.cycles)) return response.cycles;
  return asList(response, "monthlyPlans");
}

export async function subscriptionSummary(filters = {}) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.summary",
    remote: () => listMonthlyPlansApi({ ...filters, includeSummary: true })
  });

  if (response?.summary) return response.summary;
  return response;
}

export async function createSubscription(payload) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.create",
    remote: () => createMonthlyPlanApi(payload)
  });
  return asItem(response, "monthlyPlan");
}

export async function previewSubscriptionSchedule(payload) {
  return executeDataSource({
    feature: "subscriptions.monthlyPlans.preview",
    remote: () => previewMonthlyPlanScheduleApi(payload)
  });
}

export async function updateSubscription(subscriptionId, payload) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.update",
    remote: () => updateMonthlyPlanApi(subscriptionId, payload)
  });
  return asItem(response, "monthlyPlan");
}

export async function cancelSubscription(subscriptionId) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.cancel",
    remote: () => cancelMonthlyPlanApi(subscriptionId)
  });
  return asItem(response, "monthlyPlan");
}

export async function generateSubscriptionAppointments(subscriptionId, payload) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.generate",
    remote: () => generateMonthlyPlanAppointmentsApi(subscriptionId, payload)
  });
  return response;
}

export async function cancelFutureSubscriptionAppointments(subscriptionId, payload = {}) {
  return executeDataSource({
    feature: "subscriptions.monthlyPlans.cancelFutureAppointments",
    remote: () => cancelFutureMonthlyPlanAppointmentsApi(subscriptionId, payload)
  });
}

export async function markSubscriptionPayment(subscriptionId, month, status, extra = {}) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.payments",
    remote: () => markMonthlyPlanPaymentApi(subscriptionId, { month, status, ...extra })
  });
  return asItem(response, "cycle");
}
