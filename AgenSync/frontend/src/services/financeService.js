import { financeApi } from "../api/modules/insightsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

export function getFinanceSummary(params) {
  return executeDataSource({
    feature: "finance.summary",
    remote: () => financeApi(params)
  });
}
