import { financeApi, financeOverviewApi } from "../api/modules/insightsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

export function getFinanceSummary(params) {
  return executeDataSource({
    feature: "finance.summary",
    remote: () => financeApi(params)
  });
}

export function getFinanceOverview(params) {
  return executeDataSource({
    feature: "finance.overview",
    remote: () => financeOverviewApi(params)
  });
}
