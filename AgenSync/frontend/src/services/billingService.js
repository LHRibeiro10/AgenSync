import {
  createBillingCheckoutSessionApi,
  createBillingPortalSessionApi,
  getBillingStatusApi
} from "../api/modules/billingApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

export function getBillingStatus() {
  return executeDataSource({
    feature: "billing.status",
    remote: () => getBillingStatusApi()
  });
}

export function createBillingCheckoutSession(payload) {
  return executeDataSource({
    feature: "billing.checkout",
    remote: () => createBillingCheckoutSessionApi(payload)
  });
}

export function createBillingPortalSession() {
  return executeDataSource({
    feature: "billing.portal",
    remote: () => createBillingPortalSessionApi()
  });
}
