import { dashboardApi } from "../api/modules/insightsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";
import { localCoreMockApi } from "../mocks/localApi/coreMockApi.js";

export function getDashboard(params) {
  return executeDataSource({
    feature: "dashboard.summary",
    remote: () => dashboardApi(params),
    mock: () => localCoreMockApi.dashboard(params)
  });
}
