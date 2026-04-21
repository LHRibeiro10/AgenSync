import { dashboardApi } from "../api/modules/insightsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

export function getDashboard(params) {
  return executeDataSource({
    feature: "dashboard.summary",
    remote: () => dashboardApi(params)
  });
}
