import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function dashboardApi(params) {
  return httpClient.get(endpoints.dashboard, { params, cacheTtlMs: 30000 });
}

export function dashboardOverviewApi(params) {
  return httpClient.get(endpoints.dashboardOverview, { params, cacheTtlMs: 30000 });
}

export function financeApi(params) {
  return httpClient.get(endpoints.finance, { params, cacheTtlMs: 30000 });
}
