import {
  cancelMonthlyPlanApi,
  createMonthlyPlanApi,
  listMonthlyPlansApi,
  markMonthlyPlanPaymentApi,
  updateMonthlyPlanApi
} from "../api/modules/monthlyPlansApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";
import * as subscriptionsMock from "../mocks/legacy/subscriptionsMock.js";

function asList(value, key) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function asItem(value, key) {
  if (value?.[key]) return value[key];
  return value;
}

export const subscriptionStatusLabel = subscriptionsMock.subscriptionStatusLabel;
export const sumPaidSubscriptionCycles = subscriptionsMock.sumPaidSubscriptionCycles;
export const sumExpectedSubscriptionCycles = subscriptionsMock.sumExpectedSubscriptionCycles;

export async function listSubscriptions(filters = {}) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.list",
    remote: () => listMonthlyPlansApi(filters),
    mock: () => subscriptionsMock.listSubscriptions(filters)
  });
  return asList(response, "monthlyPlans");
}

export async function listSubscriptionCycles(filters = {}) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.cycles",
    remote: () => listMonthlyPlansApi({ ...filters, includeCycles: true }),
    mock: () => subscriptionsMock.listSubscriptionCycles(filters)
  });

  if (Array.isArray(response?.cycles)) return response.cycles;
  return asList(response, "monthlyPlans");
}

export async function subscriptionSummary(filters = {}) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.summary",
    remote: () => listMonthlyPlansApi({ ...filters, includeSummary: true }),
    mock: () => subscriptionsMock.subscriptionSummary(filters)
  });

  if (response?.summary) return response.summary;
  return response;
}

export async function createSubscription(payload) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.create",
    remote: () => createMonthlyPlanApi(payload),
    mock: () => subscriptionsMock.createSubscription(payload)
  });
  return asItem(response, "monthlyPlan");
}

export async function updateSubscription(subscriptionId, payload) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.update",
    remote: () => updateMonthlyPlanApi(subscriptionId, payload),
    mock: () => subscriptionsMock.updateSubscription(subscriptionId, payload)
  });
  return asItem(response, "monthlyPlan");
}

export async function cancelSubscription(subscriptionId) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.cancel",
    remote: () => cancelMonthlyPlanApi(subscriptionId),
    mock: () => subscriptionsMock.cancelSubscription(subscriptionId)
  });
  return asItem(response, "monthlyPlan");
}

export async function markSubscriptionPayment(subscriptionId, month, status) {
  const response = await executeDataSource({
    feature: "subscriptions.monthlyPlans.payments",
    remote: () => markMonthlyPlanPaymentApi(subscriptionId, { month, status }),
    mock: () => subscriptionsMock.markSubscriptionPayment(subscriptionId, month, status)
  });
  return asItem(response, "cycle");
}
