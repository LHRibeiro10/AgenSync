import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function dashboardApi(params) {
  return httpClient.get(endpoints.dashboard, { params });
}

export function financeApi(params) {
  return httpClient.get(endpoints.finance, { params });
}
