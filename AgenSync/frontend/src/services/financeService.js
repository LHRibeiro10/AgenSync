import { financeApi } from "../api/modules/insightsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";
import { localCoreMockApi } from "../mocks/localApi/coreMockApi.js";

export function getFinanceSummary(params) {
  return executeDataSource({
    feature: "finance.summary",
    remote: () => financeApi(params),
    mock: () => localCoreMockApi.finance(params)
  });
}
